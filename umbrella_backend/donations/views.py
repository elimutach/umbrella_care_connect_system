import json
from functools import wraps
from accounts.models import UserManagement

from django.views.decorators.http import require_GET
from decimal import Decimal, InvalidOperation

from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Q, Sum
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import Donation
from .forms import DonationForm
from stock.services import add_stock_from_donation

from django.contrib.auth.decorators import login_required
from needs.models import NeedRecord
from .models import Donation, DonorPledge
from calendarapp.models import CalendarEvent
from types import SimpleNamespace

def donation_list_view(request):
    donations = Donation.objects.select_related("donor", "need", "recorded_by").order_by("-created_at")
    return render(request, "donations/donation_list.html", {"donations": donations})

DEV_NO_AUTH = False


def _pick_dev_donor():
    donor = UserManagement.objects.filter(role="donor", is_active=True).first()
    if donor:
        return donor

    any_user = UserManagement.objects.filter(is_active=True).first()
    if any_user:
        return any_user

    return SimpleNamespace(
        id=None,
        first_name="Guest",
        last_name="Donor",
        username="guest_donor",
        email="donor@local.test",
        phone="",
        role="donor",
        is_authenticated=True,
    )


def _reject_non_donor(request):
    if DEV_NO_AUTH:
        return None

    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required."}, status=401)

    if getattr(request.user, "role", None) != "donor":
        return JsonResponse({"error": "Donor access only."}, status=403)

    return None


def session_api_login_required(view_func):
    @wraps(view_func)
    def wrapped(request, *args, **kwargs):
        if DEV_NO_AUTH:
            request.user = _pick_dev_donor()
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

def donation_create_view(request):
    if request.method == "POST":
        form = DonationForm(request.POST)
        if form.is_valid():
            donation = form.save()

            add_stock_from_donation(
                donation,
                user=request.user if request.user.is_authenticated else None
            )

            messages.success(request, "Donation recorded successfully.")
            return redirect("donation_list")
    else:
        form = DonationForm()

    return render(request, "donations/donation_form.html", {"form": form})


def _to_decimal(value):
    if value in (None, "", "null"):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def _get_donor_name(user):
    if not user:
        return "Anonymous Donor"

    first_name = getattr(user, "first_name", "") or ""
    last_name = getattr(user, "last_name", "") or ""
    full_name = f"{first_name} {last_name}".strip()
    return full_name or getattr(user, "username", "") or getattr(user, "email", "") or "Anonymous Donor"


def _get_reference_code(donation):
    reference_code = getattr(donation, "reference_code", None)
    if reference_code:
        return reference_code

    short_id = str(donation.id).replace("-", "").upper()[:10]
    return f"#UCC{short_id}"


def _get_payment_method_value(donation):
    payment_method = getattr(donation, "payment_method", None)
    if payment_method:
        return payment_method

    if donation.donation_type == "in_kind":
        return "in_kind"
    return "cash"


def _get_payment_method_label(payment_method):
    labels = {
        "mpesa": "Mpesa",
        "paypal": "PayPal",
        "credit_card": "Credit Card",
        "bank_transfer": "Bank Transfer",
        "cash": "Cash",
        "in_kind": "In Kind",
    }
    return labels.get(payment_method, str(payment_method).replace("_", " ").title())


def _get_status_label(status):
    labels = {
        "pending": "Pending",
        "confirmed": "Confirmed",
        "received": "Received",
        "cancelled": "Cancelled",
    }
    return labels.get(status, str(status).title())


def _format_amount(donation):
    if donation.donation_type == "cash":
        amount = donation.amount or Decimal("0.00")
        return f"KES {amount:,.2f}"

    quantity = donation.quantity or Decimal("0")
    unit = donation.unit or "units"
    item_name = donation.item_name or "items"
    return f"{quantity} {unit} · {item_name}"


def _format_pledge(donation):
    pledge_amount = getattr(donation, "pledge_amount", None)
    if pledge_amount:
        return f"KES {pledge_amount:,.2f}/month"
    return "-"


def _serialize_donation(donation, row_number=None):
    donor_name = _get_donor_name(donation.donor)
    payment_method = _get_payment_method_value(donation)

    created_source = donation.created_at if donation.created_at else donation.donation_date
    if hasattr(created_source, "tzinfo") and created_source.tzinfo is not None:
        created_text = timezone.localtime(created_source).strftime("%d %b %Y, %I:%M %p")
    else:
        created_text = created_source.strftime("%d %b %Y, %I:%M %p")

    return {
        "id": str(donation.id),
        "need_id": str(donation.need_id) if donation.need_id else "",
        "row_number": row_number,
        "donor_name": donor_name,
        "row_label": f"{row_number}. {donor_name}" if row_number else donor_name,
        "reference_code": _get_reference_code(donation),
        "email": getattr(donation.donor, "email", "") or "-",
        "method": payment_method,
        "method_label": _get_payment_method_label(payment_method),
        "datetime": created_text,
        "country": getattr(donation, "country", None) or "-",
        "pledge": _format_pledge(donation),
        "amount": _format_amount(donation),
        "status": donation.status,
        "status_label": _get_status_label(donation.status),
        "donation_towards": getattr(donation.need, "title", None) or donation.item_name or "General Donation",
        "comment": donation.notes or donation.item_description or "-",
        "is_favorite": bool(getattr(donation, "is_favorite", False)),
        "avatar_url": "https://i.pravatar.cc/44?img=1",
    }


def _apply_ordering(queryset, ordering):
    ordering_map = {
        "donor_name": "donor__username",
        "email": "donor__email",
        "payment_method": "payment_method",
        "created_at": "created_at",
        "country": "country",
        "pledge_amount": "pledge_amount",
        "amount": "amount",
        "status": "status",
        "need_title": "need__title",
        "notes": "notes",
    }

    base = (ordering or "-created_at").lstrip("-")
    field = ordering_map.get(base, "created_at")
    final_ordering = f"-{field}" if str(ordering).startswith("-") else field
    return queryset.order_by(final_ordering, "-created_at")


@require_http_methods(["GET"])
def donation_api_list(request):
    queryset = Donation.objects.select_related("donor", "need", "recorded_by").all()

    search = request.GET.get("search", "").strip()
    if search:
        queryset = queryset.filter(
            Q(donor__username__icontains=search)
            | Q(donor__email__icontains=search)
            | Q(need__title__icontains=search)
            | Q(item_name__icontains=search)
            | Q(item_description__icontains=search)
            | Q(notes__icontains=search)
            | Q(reference_code__icontains=search)
        )

    status_value = request.GET.get("status", "all").strip()
    if status_value and status_value != "all":
        queryset = queryset.filter(status=status_value)

    method_value = request.GET.get("method", "all").strip()
    if method_value and method_value != "all":
        if method_value == "in_kind":
            queryset = queryset.filter(donation_type="in_kind")
        else:
            queryset = queryset.filter(payment_method=method_value)

    country_value = request.GET.get("country", "all").strip()
    if country_value and country_value != "all":
        queryset = queryset.filter(country__iexact=country_value)

    tab_value = request.GET.get("tab", "latest").strip()
    if tab_value == "favorites":
        queryset = queryset.filter(is_favorite=True)
    elif tab_value == "top":
        queryset = queryset.order_by("-amount", "-created_at")
    else:
        queryset = _apply_ordering(queryset, request.GET.get("ordering", "-created_at"))

    page = max(int(request.GET.get("page", 1) or 1), 1)
    page_size = max(min(int(request.GET.get("page_size", 10) or 10), 100), 1)

    paginator = Paginator(queryset, page_size)
    page_obj = paginator.get_page(page)

    total_count = paginator.count
    start = (page_obj.number - 1) * page_size + 1 if total_count else 0
    end = start + len(page_obj.object_list) - 1 if total_count else 0

    results = [
        _serialize_donation(donation, row_number=start + index)
        for index, donation in enumerate(page_obj.object_list)
    ]

    return JsonResponse({
        "count": total_count,
        "page": page_obj.number,
        "page_size": page_size,
        "num_pages": paginator.num_pages,
        "start": start,
        "end": end,
        "results": results,
    })


@require_http_methods(["GET"])
def donation_api_stats(request):
    today = timezone.now().date()
    month_start = today.replace(day=1)

    successful_statuses = ["confirmed", "received"]

    monthly_total = (
        Donation.objects.filter(
            donation_type="cash",
            donation_date__gte=month_start,
            status__in=successful_statuses,
        ).aggregate(total=Sum("amount"))["total"]
        or Decimal("0.00")
    )

    all_time_total = (
        Donation.objects.filter(
            donation_type="cash",
            status__in=successful_statuses,
        ).aggregate(total=Sum("amount"))["total"]
        or Decimal("0.00")
    )

    distinct_donors = (
        Donation.objects.exclude(donor_id__isnull=True)
        .values("donor_id")
        .distinct()
        .count()
    )

    total_donations = Donation.objects.count()
    successful_donations = Donation.objects.filter(status__in=successful_statuses).count()
    active_goal_percentage = round((successful_donations / total_donations) * 100) if total_donations else 0
    successful_cash_count = Donation.objects.filter(
        donation_type="cash",
        status__in=successful_statuses,
    ).count()
    average_donation = (
        all_time_total / successful_cash_count if successful_cash_count else Decimal("0.00")
    )

    return JsonResponse({
        "monthly_total": f"KES {monthly_total:,.2f}",
        "active_goal_percentage": f"{active_goal_percentage}%",
        "donor_count": distinct_donors,
        "all_time_total": f"KES {all_time_total:,.2f}",
        "average_donation": f"KES {average_donation:,.2f}",
    })


@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
def donation_api_detail(request, donation_id):
    donation = get_object_or_404(
        Donation.objects.select_related("donor", "need", "recorded_by"),
        id=donation_id,
    )

    if request.method == "GET":
        return JsonResponse(_serialize_donation(donation))

    if request.method == "PATCH":
        payload = json.loads(request.body or "{}")

        if "status" in payload and payload["status"] in dict(Donation.STATUS_CHOICES):
            donation.status = payload["status"]

        if "notes" in payload:
            donation.notes = payload["notes"]

        if hasattr(donation, "country") and "country" in payload:
            donation.country = payload["country"] or None

        if hasattr(donation, "payment_method") and "payment_method" in payload:
            donation.payment_method = payload["payment_method"] or None

        if hasattr(donation, "pledge_amount") and "pledge_amount" in payload:
            donation.pledge_amount = _to_decimal(payload["pledge_amount"])

        if hasattr(donation, "is_favorite") and "is_favorite" in payload:
            donation.is_favorite = bool(payload["is_favorite"])

        donation.updated_at = timezone.now()
        donation.save()

        return JsonResponse({
            "success": True,
            "donation": _serialize_donation(donation),
        })

    donation.delete()
    return JsonResponse({"success": True})

def _reject_non_donor(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required."}, status=401)

    if getattr(request.user, "role", None) != "donor":
        return JsonResponse({"error": "Donor access only."}, status=403)

    return None


def _serialize_need_for_donor(need):
    amount_needed = getattr(need, "amount_needed", None)
    if amount_needed is None:
        amount_needed = getattr(need, "quantity_required", 0) or 0

    amount_received = getattr(need, "amount_received", None)
    if amount_received is None:
        amount_received = getattr(need, "quantity_fulfilled", 0) or 0

    donor_count = getattr(need, "number_of_donors", None)
    try:
        donor_count = int(donor_count or 0)
    except (TypeError, ValueError):
        donor_count = 0

    if donor_count == 0 and isinstance(getattr(need, "donors", None), list):
        donor_count = len(need.donors)

    percent = 0
    try:
        needed_num = float(amount_needed or 0)
        received_num = float(amount_received or 0)
        percent = round((received_num / needed_num) * 100) if needed_num > 0 else 0
    except (TypeError, ValueError, ZeroDivisionError):
        percent = 0

    created_at = getattr(need, "created_at", None)
    expiring_at = getattr(need, "expiring_at", None)
    date_value = getattr(need, "date", None)

    return {
        "id": str(need.id),
        "needs_registration_code": getattr(need, "needs_registration_code", "") or "",
        "title": getattr(need, "title", "") or "Untitled need",
        "description": getattr(need, "description", "") or "",
        "status": getattr(need, "status", "pending") or "pending",
        "need_type": getattr(need, "need_type", "cash") or "cash",
        "unit": getattr(need, "unit", "units") or "units",
        "image_url": getattr(need, "image_url", "") or "",
        "amount_needed": float(amount_needed or 0),
        "amount_received": float(amount_received or 0),
        "donor_count": donor_count,
        "progress_percent": percent,
        "date": date_value.isoformat() if hasattr(date_value, "isoformat") else (date_value or ""),
        "created_at": created_at.isoformat() if hasattr(created_at, "isoformat") else "",
        "expiring_at": expiring_at.isoformat() if hasattr(expiring_at, "isoformat") else "",
    }


def _serialize_pledge(pledge):
    return {
        "id": str(pledge.id),
        "need_id": str(pledge.need_id) if pledge.need_id else None,
        "title": getattr(pledge.need, "title", None) or "Untitled need",
        "amount": float(pledge.amount or 0),
        "amount_label": f"KES {pledge.amount:,.2f}",
        "frequency": pledge.frequency,
        "start_date": pledge.start_date.isoformat() if pledge.start_date else None,
        "next_due_date": pledge.next_due_date.isoformat() if pledge.next_due_date else None,
        "status": pledge.status,
        "notes": pledge.notes or "",
        "created_at": pledge.created_at.isoformat() if pledge.created_at else None,
    }



@require_http_methods(["GET"])
@session_api_login_required
def donor_needs_api(request):
    rejected = _reject_non_donor(request)
    if rejected:
        return rejected

    queryset = NeedRecord.objects.all().order_by("-created_at")

    search = request.GET.get("search", "").strip()
    if search:
        queryset = queryset.filter(
            Q(title__icontains=search)
            | Q(description__icontains=search)
            | Q(needs_registration_code__icontains=search)
        )

    status_value = request.GET.get("status", "all").strip()
    if status_value and status_value != "all":
        queryset = queryset.filter(status=status_value)

    need_type = request.GET.get("need_type", "").strip()
    if need_type:
        queryset = queryset.filter(need_type=need_type)

    results = [_serialize_need_for_donor(item) for item in queryset]

    return JsonResponse({
        "count": len(results),
        "results": results,
    })


@require_http_methods(["GET"])
@session_api_login_required
def donor_history_api(request):
    rejected = _reject_non_donor(request)
    if rejected:
        return rejected

    queryset = (
        Donation.objects
        .select_related("donor", "need", "recorded_by")
        .filter(donor_id=request.user.id)
        .order_by("-created_at")
    )

    results = []
    for index, donation in enumerate(queryset, start=1):
        row = _serialize_donation(donation, row_number=index)
        row["donation_type"] = donation.donation_type
        row["amount_value"] = float(donation.amount or 0) if donation.amount is not None else 0
        row["quantity_value"] = float(donation.quantity or 0) if donation.quantity is not None else 0
        row["unit"] = donation.unit or ""
        row["item_name"] = donation.item_name or ""
        results.append(row)

    return JsonResponse({
        "count": len(results),
        "results": results,
    })


@require_http_methods(["GET"])
@session_api_login_required
def donor_stats_api(request):
    rejected = _reject_non_donor(request)
    if rejected:
        return rejected

    successful_statuses = ["confirmed", "received"]
    donor_id = request.user.id
    today = timezone.localdate()

    successful_cash = Donation.objects.filter(
        donor_id=donor_id,
        donation_type="cash",
        status__in=successful_statuses,
    )

    total_donated = successful_cash.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

    active_pledges = DonorPledge.objects.filter(
        donor_id=donor_id,
        status="active",
    ).count()

    needs_supported = (
        Donation.objects.filter(
            donor_id=donor_id,
            status__in=successful_statuses,
        )
        .exclude(need_id__isnull=True)
        .values("need_id")
        .distinct()
        .count()
    )

    upcoming_events = CalendarEvent.objects.filter(
        Q(status__in=["scheduled", "tentative"]),
        Q(end_date__gte=today) | Q(end_date__isnull=True, start_date__gte=today),
    ).count()

    return JsonResponse({
        "total_donated": float(total_donated),
        "total_donated_label": f"KES {total_donated:,.2f}",
        "active_pledges": active_pledges,
        "needs_supported": needs_supported,
        "upcoming_events": upcoming_events,
    })


@csrf_exempt
@require_http_methods(["POST"])
@session_api_login_required
def donor_submit_donation_api(request):
    rejected = _reject_non_donor(request)
    if rejected:
        return rejected

    payload = json.loads(request.body or "{}")
    need_id = payload.get("need_id")

    if not need_id:
        return JsonResponse({"error": "Need is required."}, status=400)

    need = get_object_or_404(NeedRecord, id=need_id)

    donation_type = (payload.get("donation_type") or getattr(need, "need_type", "cash")).strip()
    if donation_type not in dict(Donation.DONATION_TYPE_CHOICES):
        return JsonResponse({"error": "Invalid donation type."}, status=400)

    if getattr(need, "need_type", donation_type) != donation_type:
        return JsonResponse(
            {"error": f"This need only accepts {getattr(need, 'need_type', donation_type)} donations."},
            status=400,
        )

    notes = (payload.get("notes") or "").strip()

    donation_kwargs = {
        "donor": request.user,
        "need": need,
        "source": "donor",
        "donation_type": donation_type,
        "status": "pending",
        "donation_date": timezone.now().date(),
        "notes": notes,
        "created_at": timezone.now(),
        "updated_at": timezone.now(),
    }

    if donation_type == "cash":
        amount = _to_decimal(payload.get("amount"))
        if amount is None or amount <= 0:
            return JsonResponse({"error": "Enter a valid cash amount."}, status=400)

        donation_kwargs["amount"] = amount
    else:
        quantity = _to_decimal(payload.get("quantity"))
        item_name = (payload.get("item_name") or "").strip()
        unit = (payload.get("unit") or getattr(need, "unit", "units") or "units").strip()
        item_description = (payload.get("item_description") or "").strip()

        if quantity is None or quantity <= 0:
            return JsonResponse({"error": "Enter a valid quantity."}, status=400)

        if not item_name:
            return JsonResponse({"error": "Item name is required for in-kind donations."}, status=400)

        donation_kwargs["quantity"] = quantity
        donation_kwargs["item_name"] = item_name
        donation_kwargs["unit"] = unit
        donation_kwargs["item_description"] = item_description

    donation = Donation.objects.create(**donation_kwargs)

    row = _serialize_donation(donation)
    row["donation_type"] = donation.donation_type
    row["amount_value"] = float(donation.amount or 0) if donation.amount is not None else 0
    row["quantity_value"] = float(donation.quantity or 0) if donation.quantity is not None else 0
    row["unit"] = donation.unit or ""
    row["item_name"] = donation.item_name or ""

    return JsonResponse({
        "success": True,
        "message": "Donation submitted successfully.",
        "donation": row,
    }, status=201)


@csrf_exempt
@require_http_methods(["GET", "POST"])
@session_api_login_required
def donor_pledges_api(request):
    rejected = _reject_non_donor(request)
    if rejected:
        return rejected

    if request.method == "GET":
        queryset = (
            DonorPledge.objects
            .select_related("need", "donor")
            .filter(donor_id=request.user.id)
            .order_by("-created_at")
        )

        active = []
        past = []

        for pledge in queryset:
            row = _serialize_pledge(pledge)
            if pledge.status == "active":
                active.append(row)
            else:
                past.append(row)

        return JsonResponse({
            "active": active,
            "past": past,
        })

    payload = json.loads(request.body or "{}")
    need_id = payload.get("need_id")
    amount = _to_decimal(payload.get("amount"))
    frequency = (payload.get("frequency") or "").strip().lower()
    start_date = payload.get("start_date")
    notes = (payload.get("notes") or "").strip()

    if not need_id:
        return JsonResponse({"error": "Need is required."}, status=400)

    if amount is None or amount <= 0:
        return JsonResponse({"error": "Enter a valid pledge amount."}, status=400)

    valid_frequencies = dict(DonorPledge.FREQUENCY_CHOICES)
    if frequency not in valid_frequencies:
        return JsonResponse({"error": "Invalid pledge frequency."}, status=400)

    need = get_object_or_404(NeedRecord, id=need_id)

    if getattr(need, "need_type", "cash") != "cash":
        return JsonResponse({"error": "Only cash needs can be pledged."}, status=400)

    if start_date:
        try:
            start_date_obj = timezone.datetime.fromisoformat(start_date).date()
        except ValueError:
            return JsonResponse({"error": "Invalid start date."}, status=400)
    else:
        start_date_obj = timezone.now().date()

    if frequency == "weekly":
        next_due_date = start_date_obj + timezone.timedelta(days=7)
    elif frequency == "biweekly":
        next_due_date = start_date_obj + timezone.timedelta(days=14)
    elif frequency == "monthly":
        next_due_date = start_date_obj + timezone.timedelta(days=30)
    else:
        next_due_date = start_date_obj + timezone.timedelta(days=90)

    pledge = DonorPledge.objects.create(
        donor=request.user,
        need=need,
        amount=amount,
        frequency=frequency,
        start_date=start_date_obj,
        next_due_date=next_due_date,
        status="active",
        notes=notes,
        created_at=timezone.now(),
        updated_at=timezone.now(),
    )

    return JsonResponse({
        "success": True,
        "message": "Pledge created successfully.",
        "pledge": _serialize_pledge(pledge),
    }, status=201)
