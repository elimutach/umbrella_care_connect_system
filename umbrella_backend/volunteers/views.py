import json
from functools import wraps
from types import SimpleNamespace
from datetime import timedelta

from django.db import transaction
from django.db.models import Count, Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_http_methods

from accounts.models import UserManagement
from .models import (
    VolunteerEvent,
    VolunteerProfile,   # keep for old signup/event logic if needed
    VolunteerSignup,
    VolunteerActivity,
    VolunteerApplication,
    VolunteerApplicationLog,
    VolunteerDashboardEvent,
)

def _json_body(request):
    try:
        return json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return {}
    

DEV_NO_AUTH = True


def _pick_dev_user(preferred_role="volunteer"):
    qs = UserManagement.objects.filter(is_active=True)

    user = qs.filter(role=preferred_role).first()
    if user:
        return user

    user = qs.first()
    if user:
        return user

    return SimpleNamespace(
        id=None,
        first_name="Guest",
        last_name=preferred_role.title(),
        username=f"guest_{preferred_role}",
        email=f"{preferred_role}@local.test",
        phone="",
        role=preferred_role,
        is_authenticated=True,
        is_staff=(preferred_role == "admin"),
    )


def _is_admin(user):
    if DEV_NO_AUTH:
        return True
    return user.is_authenticated and (
        getattr(user, "is_staff", False) or getattr(user, "role", "") == "admin"
    )


def _is_volunteer(user):
    if DEV_NO_AUTH:
        return True
    return user.is_authenticated and getattr(user, "role", "") == "volunteer"


def session_api_login_required(view_func):
    @wraps(view_func)
    def wrapped(request, *args, **kwargs):
        if DEV_NO_AUTH:
            preferred_role = "admin" if "/api/volunteers/" in request.path else "volunteer"
            request.user = _pick_dev_user(preferred_role)
            return view_func(request, *args, **kwargs)

        user_id = request.session.get("user_id")
        if not user_id:
            return JsonResponse({"error": "Authentication required"}, status=401)

        user = UserManagement.objects.filter(id=user_id, is_active=True).first()
        if not user:
            request.session.flush()
            return JsonResponse({"error": "Authentication required"}, status=401)

        request.user = user
        return view_func(request, *args, **kwargs)
    return wrapped


def _user_name(user):
    return (
        getattr(user, "name", None)
        or f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip()
        or getattr(user, "username", "")
        or getattr(user, "email", "User")
    )


def _is_admin(user):
    return user.is_authenticated and (
        getattr(user, "is_staff", False) or getattr(user, "role", "") == "admin"
    )


def _is_volunteer(user):
    return user.is_authenticated and getattr(user, "role", "") == "volunteer"




@session_api_login_required
@require_GET
def volunteer_opportunities_api(request):
    if not _is_volunteer(request.user) and not _is_admin(request.user):
        return JsonResponse({"error": "Unauthorized"}, status=403)

    events = VolunteerEvent.objects.filter(
        is_active=True,
        event_date__gte=timezone.now()
    ).annotate(
        signup_count=Count("signups", filter=~Q(signups__status=VolunteerSignup.Status.CANCELLED))
    ).order_by("event_date")

    data = []
    current_profile = getattr(request.user, "volunteer_profile", None)

    for event in events:
        already_signed_up = False
        if current_profile:
            already_signed_up = VolunteerSignup.objects.filter(
                event=event,
                volunteer=current_profile
            ).exists()

        data.append({
            "id": event.id,
            "title": event.title,
            "description": event.description,
            "event_date": event.event_date.isoformat(),
            "location": event.location,
            "slots_total": event.slots_total,
            "slots_taken": event.signup_count,
            "slots_remaining": max(event.slots_total - event.signup_count, 0),
            "already_signed_up": already_signed_up,
        })

    return JsonResponse({"results": data}, status=200)


@session_api_login_required
@require_http_methods(["POST"])
def volunteer_signup_api(request, event_id):
    if not _is_volunteer(request.user):
        return JsonResponse({"error": "Only volunteers can sign up"}, status=403)

    profile = getattr(request.user, "volunteer_profile", None)
    if not profile:
        return JsonResponse({"error": "Volunteer profile not found"}, status=400)

    try:
        event = VolunteerEvent.objects.get(id=event_id, is_active=True)
    except VolunteerEvent.DoesNotExist:
        return JsonResponse({"error": "Event not found"}, status=404)

    if event.event_date < timezone.now():
        return JsonResponse({"error": "You cannot sign up for a past event"}, status=400)

    existing = VolunteerSignup.objects.filter(event=event, volunteer=profile).first()
    if existing:
        return JsonResponse({"error": "You already signed up for this event"}, status=400)

    active_signups = VolunteerSignup.objects.filter(
        event=event
    ).exclude(status=VolunteerSignup.Status.CANCELLED).count()

    if active_signups >= event.slots_total:
        return JsonResponse({"error": "No remaining slots for this event"}, status=400)

    signup = VolunteerSignup.objects.create(
        event=event,
        volunteer=profile,
        status=VolunteerSignup.Status.CONFIRMED,
    )

    return JsonResponse({
        "message": "Signup successful",
        "signup_id": signup.id,
    }, status=201)


@session_api_login_required
@require_GET
def volunteer_history_api(request):
    if not _is_volunteer(request.user):
        return JsonResponse({"error": "Unauthorized"}, status=403)

    profile = getattr(request.user, "volunteer_profile", None)
    if not profile:
        return JsonResponse({"results": []}, status=200)

    signups = VolunteerSignup.objects.filter(
        volunteer=profile
    ).select_related("event").order_by("-event__event_date")

    data = [{
        "id": s.id,
        "event_id": s.event.id,
        "event_title": s.event.title,
        "event_date": s.event.event_date.isoformat(),
        "location": s.event.location,
        "status": s.status,
        "signed_up_at": s.created_at.isoformat(),
    } for s in signups]

    return JsonResponse({"results": data}, status=200)


@session_api_login_required
@require_GET
def admin_volunteer_stats_api(request):
    if not _is_admin(request.user):
        return JsonResponse({"error": "Unauthorized"}, status=403)

    total_volunteers = VolunteerProfile.objects.filter(is_active=True).count()
    active_events = VolunteerEvent.objects.filter(
        is_active=True,
        event_date__gte=timezone.now()
    ).count()
    total_signups = VolunteerSignup.objects.exclude(
        status=VolunteerSignup.Status.CANCELLED
    ).count()
    attended_count = VolunteerSignup.objects.filter(
        status=VolunteerSignup.Status.ATTENDED
    ).count()

    return JsonResponse({
        "total_volunteers": total_volunteers,
        "active_events": active_events,
        "total_signups": total_signups,
        "attended_count": attended_count,
    })


@session_api_login_required
@require_GET
def admin_volunteers_api(request):
    if not _is_admin(request.user):
        return JsonResponse({"error": "Unauthorized"}, status=403)

    search = request.GET.get("search", "").strip()

    qs = (
        UserManagement.objects
        .filter(role="volunteer", is_active=True)
        .order_by("-created_at")
    )

    if search:
        qs = qs.filter(
            Q(first_name__icontains=search) |
            Q(last_name__icontains=search) |
            Q(full_name__icontains=search) |
            Q(username__icontains=search) |
            Q(email__icontains=search) |
            Q(phone__icontains=search) |
            Q(volunteer_profile__skills__icontains=search)
        )

    results = []

    for user in qs:
        try:
            profile = user.volunteer_profile
        except Exception:
            profile = None

        skills = ""
        availability = ""

        if profile:
            skills = profile.skills or ""

            raw_availability = profile.availability
            if isinstance(raw_availability, list):
                availability = ", ".join(str(item) for item in raw_availability)
            elif isinstance(raw_availability, dict):
                availability = ", ".join(f"{k}: {v}" for k, v in raw_availability.items())
            else:
                availability = str(raw_availability or "")

        signups_count = VolunteerApplication.objects.filter(
            email__iexact=user.email
        ).exclude(
            status__iexact="rejected"
        ).count()

        results.append({
            "id": str(user.id),
            "name": user.full_name or _user_name(user),
            "email": user.email or "",
            "phone": user.phone or "",
            "skills": skills,
            "availability": availability,
            "is_active": bool(user.is_active and str(user.status).lower() == "active"),
            "signups_count": signups_count,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        })

    return JsonResponse({"results": results}, status=200)


@session_api_login_required
@require_http_methods(["GET", "POST"])
def admin_events_api(request):
    if not _is_admin(request.user):
        return JsonResponse({"error": "Unauthorized"}, status=403)

    if request.method == "GET":
        events = VolunteerEvent.objects.annotate(
            signup_count=Count("signups", filter=~Q(signups__status=VolunteerSignup.Status.CANCELLED))
        ).order_by("event_date")

        results = [{
            "id": e.id,
            "title": e.title,
            "description": e.description,
            "event_date": e.event_date.isoformat(),
            "location": e.location,
            "slots_total": e.slots_total,
            "slots_taken": e.signup_count,
            "slots_remaining": max(e.slots_total - e.signup_count, 0),
            "is_active": e.is_active,
        } for e in events]

        return JsonResponse({"results": results}, status=200)

    data = _json_body(request)
    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    location = (data.get("location") or "").strip()
    event_date = data.get("event_date")
    slots_total = data.get("slots_total", 0)

    if not title or not event_date:
        return JsonResponse({"error": "Title and event date are required"}, status=400)

    try:
        event_dt = timezone.datetime.fromisoformat(event_date)
        if timezone.is_naive(event_dt):
            event_dt = timezone.make_aware(event_dt, timezone.get_current_timezone())
    except Exception:
        return JsonResponse({"error": "Invalid event date format"}, status=400)

    if event_dt < timezone.now():
        return JsonResponse({"error": "Event date cannot be in the past"}, status=400)

    try:
        slots_total = int(slots_total)
    except (TypeError, ValueError):
        return JsonResponse({"error": "Slots total must be a number"}, status=400)

    if slots_total < 1:
        return JsonResponse({"error": "Slots total must be at least 1"}, status=400)

    event = VolunteerEvent.objects.create(
        title=title,
        description=description,
        location=location,
        event_date=event_dt,
        slots_total=slots_total,
        created_by=request.user,
    )

    return JsonResponse({
        "message": "Volunteer event created successfully",
        "event": {
            "id": event.id,
            "title": event.title,
        }
    }, status=201)


@session_api_login_required
@require_GET
def admin_event_signups_api(request, event_id):
    if not _is_admin(request.user):
        return JsonResponse({"error": "Unauthorized"}, status=403)

    try:
        event = VolunteerEvent.objects.get(id=event_id)
    except VolunteerEvent.DoesNotExist:
        return JsonResponse({"error": "Event not found"}, status=404)

    signups = event.signups.select_related("volunteer__user").order_by("-created_at")
    results = [{
        "id": s.id,
        "name": _user_name(s.volunteer.user),
        "email": getattr(s.volunteer.user, "email", ""),
        "phone": s.volunteer.phone,
        "status": s.status,
        "signed_up_at": s.created_at.isoformat(),
    } for s in signups]

    return JsonResponse({
        "event": {"id": event.id, "title": event.title},
        "results": results,
    })


@session_api_login_required
@require_http_methods(["PATCH"])
def admin_signup_status_api(request, signup_id):
    if not _is_admin(request.user):
        return JsonResponse({"error": "Unauthorized"}, status=403)

    data = _json_body(request)
    status_value = data.get("status")

    if status_value not in {
        VolunteerSignup.Status.CONFIRMED,
        VolunteerSignup.Status.CANCELLED,
        VolunteerSignup.Status.ATTENDED,
    }:
        return JsonResponse({"error": "Invalid status"}, status=400)

    try:
        signup = VolunteerSignup.objects.get(id=signup_id)
    except VolunteerSignup.DoesNotExist:
        return JsonResponse({"error": "Signup not found"}, status=404)

    signup.status = status_value
    signup.save(update_fields=["status"])

    return JsonResponse({"message": "Signup status updated"}, status=200)

def _volunteer_email(user):
    return (
        getattr(user, "email", None)
        or getattr(user, "username", None)
        or ""
    ).strip()


def _latest_application_for_email(email):
    if not email:
        return None
    return (
        VolunteerApplication.objects
        .filter(email__iexact=email)
        .select_related("activity")
        .order_by("-created_at")
        .first()
    )


def _serialize_activity(activity, volunteer_email=""):
    slots_total = int(activity.number_of_volunteers or 0)

    active_apps = VolunteerApplication.objects.filter(
        activity_id=activity.id
    ).exclude(status__iexact="rejected")

    slots_taken = active_apps.count()
    already_applied = False

    if volunteer_email:
        already_applied = active_apps.filter(email__iexact=volunteer_email).exists()

    return {
        "id": str(activity.id),
        "slug": activity.slug,
        "title": activity.title,
        "description": activity.description or "",
        "image_url": activity.image_url or "",
        "is_active": activity.is_active,
        "number_of_volunteers": slots_total,
        "slots_taken": slots_taken,
        "slots_remaining": max(slots_total - slots_taken, 0),
        "already_applied": already_applied,
    }


def _find_matching_event(activity):
    # Current schema has no FK from volunteers_volunteerevent -> volunteer_activities,
    # so this matches by title for now.
    return (
        VolunteerDashboardEvent.objects
        .filter(is_active=True, title__iexact=activity.title)
        .order_by("event_date")
        .first()
    )


def _serialize_application(application):
    activity = getattr(application, "activity", None)
    activity_title = activity.title if activity else ""
    event_location = ""
    scheduled_start = None
    scheduled_end = None

    if str(application.status).lower() == "approved" and activity:
        matched_event = _find_matching_event(activity)
        if matched_event:
            scheduled_start = matched_event.event_date.isoformat()
            scheduled_end = (matched_event.event_date + timedelta(hours=4)).isoformat()
            event_location = matched_event.location or ""

    return {
        "id": str(application.id),
        "application_code": application.application_code,
        "first_name": application.first_name,
        "last_name": application.last_name,
        "phone": application.phone,
        "email": application.email,
        "county": application.county,
        "id_passport": application.id_passport,
        "passport_photo_url": application.passport_photo_url or "",
        "activity_id": str(application.activity_id) if application.activity_id else None,
        "activity_title": activity_title,
        "status": application.status,
        "source": application.source,
        "notes": application.notes or "",
        "created_at": application.created_at.isoformat() if application.created_at else None,
        "updated_at": application.updated_at.isoformat() if application.updated_at else None,
        "scheduled_start": scheduled_start,
        "scheduled_end": scheduled_end,
        "event_location": event_location,
    }


@session_api_login_required
@require_GET
def volunteer_me_api(request):
    if not _is_volunteer(request.user) and not _is_admin(request.user):
        return JsonResponse({"error": "Unauthorized"}, status=403)

    email = _volunteer_email(request.user)
    latest = _latest_application_for_email(email)

    first_name = getattr(request.user, "first_name", "") or (latest.first_name if latest else "")
    last_name = getattr(request.user, "last_name", "") or (latest.last_name if latest else "")
    phone = getattr(request.user, "phone", "") or (latest.phone if latest else "")
    county = latest.county if latest else ""
    id_passport = latest.id_passport if latest else ""
    passport_photo_url = latest.passport_photo_url if latest else ""

    return JsonResponse({
        "id": getattr(request.user, "id", None),
        "first_name": first_name,
        "last_name": last_name,
        "full_name": _user_name(request.user),
        "email": email,
        "phone": phone,
        "county": county,
        "id_passport": id_passport,
        "passport_photo_url": passport_photo_url,
        "role": getattr(request.user, "role", "volunteer"),
    }, status=200)


@session_api_login_required
@require_GET
def volunteer_activities_api(request):
    if not _is_volunteer(request.user) and not _is_admin(request.user):
        return JsonResponse({"error": "Unauthorized"}, status=403)

    volunteer_email = _volunteer_email(request.user)

    activities = (
        VolunteerActivity.objects
        .filter(is_active=True)
        .order_by("-created_at", "title")
    )

    results = [_serialize_activity(activity, volunteer_email) for activity in activities]
    return JsonResponse({"results": results}, status=200)


@session_api_login_required
@require_http_methods(["GET", "POST"])
def volunteer_applications_api(request):
    if request.method == "GET":
        if not _is_volunteer(request.user) and not _is_admin(request.user):
            return JsonResponse({"error": "Unauthorized"}, status=403)

        volunteer_email = _volunteer_email(request.user)
        status_filter = request.GET.get("status", "").strip().lower()

        qs = (
            VolunteerApplication.objects
            .filter(email__iexact=volunteer_email)
            .select_related("activity")
            .order_by("-created_at")
        )

        if status_filter and status_filter != "all":
            qs = qs.filter(status__iexact=status_filter)

        results = [_serialize_application(app) for app in qs]
        return JsonResponse({"results": results}, status=200)

    if not _is_volunteer(request.user):
        return JsonResponse({"error": "Only volunteers can apply"}, status=403)

    data = _json_body(request)
    volunteer_email = _volunteer_email(request.user)

    activity_id = data.get("activity_id")
    if not activity_id:
        return JsonResponse({"error": "Activity ID is required"}, status=400)

    try:
        activity = VolunteerActivity.objects.get(id=activity_id, is_active=True)
    except VolunteerActivity.DoesNotExist:
        return JsonResponse({"error": "Activity not found"}, status=404)

    existing = (
        VolunteerApplication.objects
        .filter(email__iexact=volunteer_email, activity_id=activity.id)
        .exclude(status__iexact="rejected")
        .first()
    )
    if existing:
        return JsonResponse(
            {"error": "You already applied for this activity"},
            status=400,
        )

    first_name = (data.get("first_name") or getattr(request.user, "first_name", "")).strip()
    last_name = (data.get("last_name") or getattr(request.user, "last_name", "")).strip()
    phone = (data.get("phone") or getattr(request.user, "phone", "")).strip()
    county = (data.get("county") or "").strip()
    id_passport = (data.get("id_passport") or "").strip()
    passport_photo_url = (data.get("passport_photo_url") or "").strip()

    if not first_name or not last_name or not phone or not volunteer_email or not county or not id_passport:
        return JsonResponse(
            {"error": "First name, last name, phone, email, county, and ID/Passport are required"},
            status=400,
        )

    with transaction.atomic():
        application = VolunteerApplication.objects.create(
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            email=volunteer_email,
            county=county,
            id_passport=id_passport,
            passport_photo_url=passport_photo_url,
            activity=activity,
            status="pending",
            source="website",
            notes="Application submitted from volunteer dashboard.",
            updated_at=timezone.now(),
        )

        VolunteerApplicationLog.objects.create(
            application=application,
            action="created",
            actor=volunteer_email or "system",
            metadata={
                "source": "dashboard",
                "activity_id": str(activity.id),
                "activity_title": activity.title,
            },
        )

    application.refresh_from_db()

    return JsonResponse(
        {
            "message": "Application submitted successfully",
            "application": _serialize_application(application),
        },
        status=201,
    )
