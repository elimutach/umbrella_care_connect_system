import hashlib
import hmac
import secrets
import string
from html import escape
from datetime import timedelta

import bcrypt
import resend

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from .models import UserManagement, DonorProfile, VolunteerProfile, AuthOtp, AuthSession
from .serializers import UserManagementSerializer
from .authentication import DashboardSessionAuthentication



OTP_LIFETIME_MINUTES = 15
SESSION_LIFETIME_MINUTES = 30
SESSION_TOKEN_LENGTH = 16


# =========================
# PAGE VIEWS
# =========================
def index_page(request):
    return render(request, "index.html")


def signin_page(request):
    return render(request, "signin.html")


def signup_page(request):
    return render(request, "signup.html")


def contact_page(request):
    return render(request, "contact.html")


def volunteer_page(request):
    return render(request, "volunteer.html")


def need_details_page(request):
    return render(request, "need-details.html")


def donate_page(request):
    return render(request, "donate.html")


def pledge_page(request):
    return render(request, "pledge.html")


def admin_signin_page(request):
    return render(request, "admin/admin-signin.html")


def admin_otp_page(request):
    return render(request, "admin/admin-otp.html")


def _get_session_user(request):
    user_id = request.session.get("user_id")
    if not user_id:
        return None

    try:
        user = UserManagement.objects.get(id=user_id, is_active=True)
    except UserManagement.DoesNotExist:
        return None

    auth_session = _get_active_auth_session(request, user)
    if not auth_session:
        request.session.flush()
        return None

    return user


@never_cache
@ensure_csrf_cookie
def dashboard_view(request):
    user = _get_session_user(request)
    if not user:
        return redirect("signin")

    return redirect(_get_dashboard_redirect_for_user(user))


def _require_role(request, *allowed_roles):
    user = _get_session_user(request)

    if not user:
        return None, redirect("signin")

    if user.role not in allowed_roles:
        return user, redirect(_get_dashboard_redirect_for_user(user))

    return user, None

@never_cache
@ensure_csrf_cookie
def admin_dashboard_view(request):
    user, response = _require_role(request, "admin")
    if response:
        return response
    return render(request, "admin/dashboard.html", {"current_user": user})

@never_cache
@ensure_csrf_cookie
def donor_dashboard_view(request):
    user, response = _require_role(request, "donor")
    if response:
        return response
    return render(request, "donor/dashboard.html", {"current_user": user})

@never_cache
@ensure_csrf_cookie
def volunteer_dashboard_view(request):
    user, response = _require_role(request, "volunteer")
    if response:
        return response
    return render(request, "volunteer/dashboard.html", {"current_user": user})


# =========================
# HELPERS
# =========================
def _get_dashboard_redirect_for_user(user=None) -> str:
    if not user:
        return "/signin/"

    role = (user.role or "").strip().lower()

    if role == "admin":
        return "/admin/dashboard/"
    if role == "donor":
        return "/donor/dashboard/"
    if role == "volunteer":
        return "/volunteer/dashboard/"

    return "/signin/"



# =========================
# HELPERS
# =========================
def _hash_value(raw_value: str) -> str:
    secret = (getattr(settings, "SECRET_KEY", "") or "fallback-secret").encode("utf-8")
    return hmac.new(secret, raw_value.encode("utf-8"), hashlib.sha256).hexdigest()


def _generate_otp_code() -> str:
    return "".join(secrets.choice(string.digits) for _ in range(6))


def _generate_session_token(length: int = SESSION_TOKEN_LENGTH) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _get_active_auth_session(request, user=None):
    session_request_token = request.session.get("auth_session_request_token")
    if not session_request_token:
        return None

    queryset = AuthSession.objects.filter(
        session_request_token=session_request_token,
        status="active",
        is_active=True,
        expires_at__gt=timezone.now(),
    )

    if user is not None:
        queryset = queryset.filter(user=user)

    return queryset.first()


def _generate_reg_code(first_name: str, role: str) -> str:
    return "UCC" + "".join(secrets.choice(string.digits) for _ in range(4)) + "/" + (first_name[:1] or "U").upper() + (role[:1] or "D").upper()


def _generate_unique_reg_code(first_name: str, role: str) -> str:
    while True:
        code = _generate_reg_code(first_name, role)
        if not UserManagement.objects.filter(reg_code=code).exists():
            return code




def _send_email_otp(email: str, code: str, purpose: str):
    api_key = getattr(settings, "RESEND_API_KEY", "") or ""
    from_email = getattr(
        settings,
        "RESEND_FROM_EMAIL",
        "Umbrella Care Connect <onboarding@resend.dev>",
    )

    if not api_key:
        return False, "RESEND_API_KEY is missing."

    resend.api_key = api_key

    subject_map = {
        "login": "Your Umbrella Care Connect sign-in code",
        "email_verification": "Verify your Umbrella Care Connect email",
        "password_reset": "Your password reset code",
    }

    action_map = {
        "login": "sign in",
        "email_verification": "verify your email",
        "password_reset": "reset your password",
    }

    subject = subject_map.get(purpose, "Your Umbrella Care Connect code")
    action = action_map.get(purpose, "continue")

    html = f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fffdf8;color:#1f2a3a">
      <h2 style="margin:0 0 12px;color:#1f2a3a;">Umbrella Care Connect</h2>
      <p style="font-size:16px;line-height:1.7;">Use the code below to {action}.</p>
      <div style="margin:24px 0;padding:18px 20px;background:#fff1d5;border-radius:16px;text-align:center;">
        <div style="font-size:32px;font-weight:800;letter-spacing:10px;color:#835500;">{code}</div>
      </div>
      <p style="font-size:14px;line-height:1.7;color:#6f7785;">This code expires in 15 minutes. Ignore this email if this was not you.</p>
    </div>
    """

    try:
        resend.Emails.send({
            "from": from_email,
            "to": [email],
            "subject": subject,
            "html": html,
        })
        return True, None
    except Exception as exc:
        return False, str(exc)


def _clean_contact_field(value, max_length):
    cleaned = " ".join(str(value or "").strip().split())
    return cleaned[:max_length]


def _contact_email_shell(title, preheader, body_html):
    return f"""
    <div style="margin:0;padding:32px;background:#050b18;color:#eef6ff;font-family:Inter,Arial,sans-serif;">
      <div style="display:none;max-height:0;overflow:hidden;">{escape(preheader)}</div>
      <div style="max-width:680px;margin:0 auto;border:1px solid rgba(128,255,255,0.24);border-radius:28px;overflow:hidden;background:linear-gradient(145deg,#0b1426,#101a2f 58%,#221605);box-shadow:0 26px 80px rgba(0,0,0,0.38);">
        <div style="padding:28px 30px;border-bottom:1px solid rgba(255,255,255,0.12);">
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.18em;color:#f4a623;font-weight:800;">Umbrella Care Connect</div>
          <h1 style="margin:10px 0 0;font-size:30px;line-height:1.2;color:#ffffff;">{escape(title)}</h1>
        </div>
        <div style="padding:30px;color:#dbe7f5;font-size:16px;line-height:1.75;">
          {body_html}
        </div>
        <div style="padding:22px 30px;background:rgba(255,255,255,0.05);color:#9fb1c8;font-size:13px;line-height:1.6;">
          Sent by Umbrella Care Connect contact automation.
        </div>
      </div>
    </div>
    """


class ContactMessageAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        name = _clean_contact_field(request.data.get("name"), 120)
        email = _clean_contact_field(request.data.get("email"), 180).lower()
        subject = _clean_contact_field(request.data.get("subject") or "New website message", 160)
        message = str(request.data.get("message") or "").strip()

        if not name or not email or not message:
            return Response({"message": "Name, email, and message are required."}, status=400)

        if len(message) < 10:
            return Response({"message": "Please write a message of at least 10 characters."}, status=400)

        try:
            validate_email(email)
        except ValidationError:
            return Response({"message": "Enter a valid email address."}, status=400)

        api_key = getattr(settings, "RESEND_API_KEY", "") or ""
        from_email = getattr(settings, "RESEND_FROM_EMAIL", "Umbrella Care Connect <onboarding@resend.dev>")
        receiver_email = getattr(settings, "CONTACT_RECEIVER_EMAIL", "") or ""

        if not api_key:
            return Response({"message": "Contact email is not configured. Missing RESEND_API_KEY."}, status=500)

        if not receiver_email:
            return Response({"message": "Contact email is not configured. Missing CONTACT_RECEIVER_EMAIL."}, status=500)

        resend.api_key = api_key

        safe_message = escape(message).replace("\n", "<br>")
        admin_html = _contact_email_shell(
            "New contact message",
            f"New message from {name}",
            f"""
            <p style="margin:0 0 18px;">A new visitor message arrived from the public contact page.</p>
            <div style="display:grid;gap:12px;margin:0 0 22px;">
              <div><strong style="color:#f4a623;">Name:</strong> {escape(name)}</div>
              <div><strong style="color:#f4a623;">Email:</strong> {escape(email)}</div>
              <div><strong style="color:#f4a623;">Subject:</strong> {escape(subject)}</div>
            </div>
            <div style="padding:18px 20px;border-radius:20px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);">
              {safe_message}
            </div>
            """,
        )

        sender_html = _contact_email_shell(
            "Message received",
            "We received your message",
            f"""
            <p style="margin:0 0 18px;">Hi {escape(name)},</p>
            <p style="margin:0 0 18px;">Thank you for reaching Umbrella Care Connect. We received your message and our team will review it as soon as possible.</p>
            <div style="padding:18px 20px;border-radius:20px;background:rgba(244,166,35,0.14);border:1px solid rgba(244,166,35,0.28);">
              <strong style="color:#f4a623;">Your message:</strong><br>
              {safe_message}
            </div>
            <p style="margin:22px 0 0;color:#9fb1c8;">If this was urgent, you can also call the home directly using the contact information on our website.</p>
            """,
        )

        try:
            resend.Emails.send({
                "from": from_email,
                "to": [receiver_email],
                "subject": f"New contact message: {subject}",
                "html": admin_html,
                "reply_to": email,
            })
            resend.Emails.send({
                "from": from_email,
                "to": [email],
                "subject": "We received your Umbrella Care Connect message",
                "html": sender_html,
            })
        except Exception:
            return Response({"message": "Email provider failed to send the contact message."}, status=502)

        return Response({"message": "Message sent. We also emailed the sender a confirmation."}, status=200)


def _deactivate_existing_otps(user, purpose):
    AuthOtp.objects.filter(
        user=user,
        purpose=purpose,
        is_active=True,
        used_at__isnull=True,
    ).update(
        is_active=False,
        updated_at=timezone.now(),
    )


def _create_otp(user, purpose):
    _deactivate_existing_otps(user, purpose)

    code = _generate_otp_code()
    now = timezone.now()

    otp = AuthOtp.objects.create(
        user=user,
        purpose=purpose,
        otp_hash=_hash_value(code),
        email_snapshot=user.email,
        code_last2=code[-2:],
        attempts=0,
        max_attempts=5,
        is_active=True,
        created_at=now,
        updated_at=now,
        expires_at=now + timedelta(minutes=OTP_LIFETIME_MINUTES),
        used_at=None,
    )

    sent, error = _send_email_otp(user.email, code, purpose)
    if not sent:
        otp.is_active = False
        otp.updated_at = now
        otp.save(update_fields=["is_active", "updated_at"])
        return None, error

    return otp, None

def _create_demo_otp(user, purpose, code="123456"):
    _deactivate_existing_otps(user, purpose)

    now = timezone.now()

    otp = AuthOtp.objects.create(
        user=user,
        purpose=purpose,
        otp_hash=_hash_value(code),
        email_snapshot=user.email,
        code_last2=code[-2:],
        attempts=0,
        max_attempts=5,
        is_active=True,
        created_at=now,
        updated_at=now,
        expires_at=now + timedelta(minutes=OTP_LIFETIME_MINUTES),
        used_at=None,
    )

    return otp, None


def _expire_user_sessions(user):
    now = timezone.now()
    active_sessions = AuthSession.objects.filter(user=user, is_active=True)

    for session in active_sessions:
        session.is_active = False
        session.status = "expired"
        session.ended_at = now
        session.active_duration_seconds = int((now - session.created_at).total_seconds())
        session.save(update_fields=["is_active", "status", "ended_at", "active_duration_seconds"])


def _create_session_for_user(user, request):
    _expire_user_sessions(user)

    token = _generate_session_token(SESSION_TOKEN_LENGTH)
    now = timezone.now()

    auth_session = AuthSession.objects.create(
        user=user,
        session_key_hash=_hash_value(token),
        token_hint=token[-4:],
        status="active",
        is_active=True,
        created_at=now,
        last_seen_at=now,
        expires_at=now + timedelta(minutes=SESSION_LIFETIME_MINUTES),
        ended_at=None,
        active_duration_seconds=0,
        metadata={
            "ip": request.META.get("REMOTE_ADDR"),
            "user_agent": request.META.get("HTTP_USER_AGENT", ""),
        },
    )

    user.current_session_key = str(auth_session.session_request_token)
    user.last_seen = now
    user.sign_in_count = (user.sign_in_count or 0) + 1
    user.updated_at = now
    user.save(update_fields=["current_session_key", "last_seen", "sign_in_count", "updated_at"])

    request.session["user_id"] = str(user.id)
    request.session["auth_session_request_token"] = str(auth_session.session_request_token)
    request.session["session_token_hint"] = auth_session.token_hint
    request.session["role"] = user.role
    request.session.set_expiry(SESSION_LIFETIME_MINUTES * 60)

    return auth_session


def _revoke_current_auth_session(request):
    user = None
    user_id = request.session.get("user_id")
    session_request_token = request.session.get("auth_session_request_token")

    if user_id:
        user = UserManagement.objects.filter(id=user_id, is_active=True).first()

    sessions = AuthSession.objects.none()
    if session_request_token:
        sessions = AuthSession.objects.filter(session_request_token=session_request_token)
        if user is not None:
            sessions = sessions.filter(user=user)
    elif user is not None:
        sessions = AuthSession.objects.filter(user=user, is_active=True, status="active")

    now = timezone.now()
    revoked_count = 0

    for auth_session in sessions:
        if auth_session.is_active or auth_session.status == "active":
            revoked_count += 1

        auth_session.is_active = False
        auth_session.status = "revoked"
        auth_session.ended_at = now
        auth_session.active_duration_seconds = max(
            0,
            int((now - auth_session.created_at).total_seconds()),
        )
        auth_session.save(
            update_fields=[
                "is_active",
                "status",
                "ended_at",
                "active_duration_seconds",
            ]
        )

    if user is not None and (
        not session_request_token or user.current_session_key == str(session_request_token)
    ):
        user.current_session_key = None
        user.last_seen = now
        user.updated_at = now
        user.save(update_fields=["current_session_key", "last_seen", "updated_at"])

    return revoked_count


# =========================
# OPEN USER MANAGEMENT API
# DEV ONLY - NO AUTH
# =========================
class UserListCreateAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        search = (request.GET.get("search") or "").strip()
        ordering = request.GET.get("ordering") or "-created_at"

        try:
            page = int(request.GET.get("page", 1))
        except ValueError:
            page = 1

        try:
            page_size = int(request.GET.get("page_size", 10))
        except ValueError:
            page_size = 10

        allowed_ordering = {
            "created_at", "-created_at",
            #"full_name", "-full_name",
            "username", "-username",
            "email", "-email",
            "reg_code", "-reg_code",
            "phone", "-phone",
            "role", "-role",
            "status", "-status",
            "last_seen", "-last_seen",
        }

        if ordering not in allowed_ordering:
            ordering = "-created_at"

        qs = UserManagement.objects.filter(is_active=True)

        if search:
            qs = qs.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(full_name__icontains=search) |
                Q(username__icontains=search) |
                Q(email__icontains=search) |
                Q(reg_code__icontains=search) |
                Q(phone__icontains=search)
            )

        qs = qs.order_by(ordering)

        total = qs.count()
        start = (page - 1) * page_size
        end = start + page_size
        users = qs[start:end]

        serializer = UserManagementSerializer(users, many=True)
        return Response({
            "count": total,
            "results": serializer.data,
        })

    def post(self, request):
        serializer = UserManagementSerializer(data=request.data, partial=False)
        if serializer.is_valid():
            user = serializer.save()
            return Response(UserManagementSerializer(user).data, status=201)
        return Response(serializer.errors, status=400)


class UserDetailAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, user_id):
        user = get_object_or_404(UserManagement, id=user_id, is_active=True)
        return Response(UserManagementSerializer(user).data)

    def patch(self, request, user_id):
        user = get_object_or_404(UserManagement, id=user_id, is_active=True)
        serializer = UserManagementSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            updated_user = serializer.save()
            return Response(UserManagementSerializer(updated_user).data)
        return Response(serializer.errors, status=400)

    def delete(self, request, user_id):
        user = get_object_or_404(UserManagement, id=user_id, is_active=True)
        now = timezone.now()

        user.is_active = False
        user.status = "terminated"
        user.terminated_at = now
        user.updated_at = now
        user.save(update_fields=["is_active", "status", "terminated_at", "updated_at"])

        return Response({"message": "User deleted successfully"})


class UserFreezeAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def patch(self, request, user_id):
        user = get_object_or_404(UserManagement, id=user_id, is_active=True)
        now = timezone.now()

        user.status = "paused"
        user.suspended_at = now
        user.updated_at = now
        user.save(update_fields=["status", "suspended_at", "updated_at"])

        return Response({"message": "User paused successfully"})


class UserChangePasswordAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, user_id):
        user = get_object_or_404(UserManagement, id=user_id, is_active=True)

        current_password = request.data.get("current_password")
        new_password = request.data.get("new_password")

        if not current_password or not new_password:
            return Response({"message": "Current password and new password are required."}, status=400)

        if len(new_password) < 8:
            return Response({"message": "New password must be at least 8 characters."}, status=400)

        stored_hash = (user.password_hash or "").encode("utf-8")
        current_password_bytes = current_password.encode("utf-8")

        try:
            password_matches = bcrypt.checkpw(current_password_bytes, stored_hash)
        except Exception:
            password_matches = False

        if not password_matches:
            return Response({"message": "Current password is incorrect."}, status=400)

        new_hash = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        user.password_hash = new_hash
        user.updated_at = timezone.now()
        user.save(update_fields=["password_hash", "updated_at"])

        return Response({"message": "Password updated successfully."}, status=200)


# =========================
# AUTH - SIGNUP
# =========================
class AuthSignupAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        data = request.data
        role = (data.get("role") or "donor").strip().lower()

        if role not in ["donor", "volunteer"]:
            return Response({"message": "Invalid role selected."}, status=400)

        first_name = (data.get("first_name") or "").strip()
        last_name = (data.get("last_name") or "").strip()
        username = (data.get("username") or "").strip()
        email = (data.get("email") or "").strip().lower()
        phone = (data.get("phone") or "").strip()
        password = (data.get("password") or "")
        confirm_password = (data.get("confirm_password") or "")

        if not first_name or not username or not email or not password:
            return Response({"message": "Required fields are missing."}, status=400)

        if password != confirm_password:
            return Response({"message": "Passwords do not match."}, status=400)

        if len(password) < 8:
            return Response({"message": "Password must be at least 8 characters."}, status=400)

        if UserManagement.objects.filter(Q(email=email) | Q(username=username)).exists():
            return Response({"message": "Email or username already exists."}, status=400)

        now = timezone.now()
        password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

        with transaction.atomic():
            user = UserManagement.objects.create(
                first_name=first_name,
                last_name=last_name or None,
                username=username,
                email=email,
                phone=phone or None,
                password_hash=password_hash,
                reg_code=_generate_unique_reg_code(first_name, role),
                role=role,
                status="paused",
                verified=False,
                is_active=True,
                current_session_key=None,
                last_seen=None,
                sign_in_count=0,
                forgot_password_change_count=0,
                suspended_at=None,
                terminated_at=None,
                created_at=now,
                updated_at=now,
                verified_at=None,
            )

            common_country = (data.get("country") or "").strip() or None
            common_city = (data.get("city") or "").strip() or None
            common_gender = (data.get("gender") or "").strip() or None

            if role == "donor":
                donor_profile = data.get("donor_profile") or {}
                DonorProfile.objects.create(
                    user=user,
                    country=common_country,
                    city=common_city,
                    gender=common_gender,
                    donor_type=(donor_profile.get("donor_type") or "").strip() or None,
                    donation_preference=(donor_profile.get("donation_preference") or "").strip() or None,
                    donor_note=(donor_profile.get("donor_note") or "").strip() or None,
                    created_at=now,
                    updated_at=now,
                )
            else:
                volunteer_profile = data.get("volunteer_profile") or {}
                VolunteerProfile.objects.create(
                    user=user,
                    country=common_country,
                    city=common_city,
                    gender=common_gender,
                    skills=(volunteer_profile.get("skills") or "").strip() or None,
                    availability=volunteer_profile.get("availability") or [],
                    areas_of_interest=volunteer_profile.get("areas_of_interest") or [],
                    created_at=now,
                    updated_at=now,
                )

        otp, error = _create_otp(user, "email_verification")
        if not otp:
            return Response({"message": f"Account created, but verification OTP could not be sent: {error}"}, status=500)

        return Response({
            "message": f"We sent a 6-digit verification code to {user.email}. Verify your email before signing in.",
            "otp_request_token": str(otp.otp_request_token),
            "expires_at": otp.expires_at.isoformat(),
        }, status=201)


class AuthSignupVerifyEmailAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        otp_request_token = request.data.get("otp_request_token")
        code = (request.data.get("code") or "").strip()

        if not otp_request_token or len(code) != 6:
            return Response({"message": "OTP request token and valid code are required."}, status=400)

        try:
            otp = AuthOtp.objects.select_related("user").get(
                otp_request_token=otp_request_token,
                purpose="email_verification",
                is_active=True,
                used_at__isnull=True,
            )
        except AuthOtp.DoesNotExist:
            return Response({"message": "Verification code not found or already used."}, status=404)

        now = timezone.now()

        if otp.expires_at <= now:
            otp.is_active = False
            otp.updated_at = now
            otp.save(update_fields=["is_active", "updated_at"])
            return Response({"message": "Verification code expired."}, status=400)

        if otp.attempts >= otp.max_attempts:
            otp.is_active = False
            otp.updated_at = now
            otp.save(update_fields=["is_active", "updated_at"])
            return Response({"message": "Maximum attempts reached."}, status=400)

        otp.attempts += 1
        otp.updated_at = now
        otp.save(update_fields=["attempts", "updated_at"])

        if _hash_value(code) != otp.otp_hash:
            return Response({"message": "Invalid verification code."}, status=400)

        otp.is_active = False
        otp.used_at = now
        otp.updated_at = now
        otp.save(update_fields=["is_active", "used_at", "updated_at"])

        user = otp.user
        user.verified = True
        user.status = "active"
        user.verified_at = now
        user.updated_at = now
        user.save(update_fields=["verified", "status", "verified_at", "updated_at"])

        return Response({
            "message": "Email verified successfully.",
            "redirect_url": "/signin/",
        })


class AuthSignupResendVerificationOtpAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        if not email:
            return Response({"message": "Email is required."}, status=400)

        try:
            user = UserManagement.objects.get(email=email, is_active=True)
        except UserManagement.DoesNotExist:
            return Response({"message": "User not found."}, status=404)

        if user.verified:
            return Response({"message": "This email is already verified."}, status=400)

        otp, error = _create_otp(user, "email_verification")
        if not otp:
            return Response({"message": f"Could not resend verification OTP: {error}"}, status=500)

        return Response({
            "message": f"A new verification code was sent to {user.email}.",
            "otp_request_token": str(otp.otp_request_token),
            "expires_at": otp.expires_at.isoformat(),
        })


# =========================
# AUTH - USER SIGNIN
# =========================
class AuthSigninRequestOtpAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        login = (request.data.get("login") or "").strip()
        password = (request.data.get("password") or "")

        if not login or not password:
            return Response({"message": "Login and password are required."}, status=400)

        try:
            user = UserManagement.objects.get(
                Q(email__iexact=login) | Q(username__iexact=login),
                is_active=True,
            )
        except UserManagement.DoesNotExist:
            return Response({"message": "Invalid credentials."}, status=400)

        if user.role == "admin":
            return Response({"message": "Use the admin sign-in page for administrator access."}, status=403)

        try:
            is_valid = bcrypt.checkpw(password.encode("utf-8"), (user.password_hash or "").encode("utf-8"))
        except Exception:
            is_valid = False

        if not is_valid:
            return Response({"message": "Invalid credentials."}, status=400)

        if not user.verified:
            return Response({"message": "Verify your email first before signing in."}, status=403)

        if user.status != "active":
            return Response({"message": "This account is not active."}, status=403)

        otp, error = _create_otp(user, "login")
        if not otp:
            return Response({"message": f"OTP email could not be sent: {error}"}, status=500)

        return Response({
            "message": f"We sent a 6-digit sign-in code to {user.email}.",
            "otp_request_token": str(otp.otp_request_token),
            "expires_at": otp.expires_at.isoformat(),
        })


class AuthSigninResendOtpAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        login = (request.data.get("login") or "").strip()

        if not login:
            return Response({"message": "Login is required."}, status=400)

        try:
            user = UserManagement.objects.get(
                Q(email__iexact=login) | Q(username__iexact=login),
                is_active=True,
            )
        except UserManagement.DoesNotExist:
            return Response({"message": "User not found."}, status=404)

        if user.role == "admin":
            return Response({"message": "Use the admin sign-in page for administrator access."}, status=403)

        if not user.verified:
            return Response({"message": "Verify your email first."}, status=403)

        if user.status != "active":
            return Response({"message": "This account is not active."}, status=403)

        otp, error = _create_otp(user, "login")
        if not otp:
            return Response({"message": f"Could not resend OTP: {error}"}, status=500)

        return Response({
            "message": f"A new sign-in code was sent to {user.email}.",
            "otp_request_token": str(otp.otp_request_token),
            "expires_at": otp.expires_at.isoformat(),
        })


class AuthSigninVerifyOtpAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        otp_request_token = request.data.get("otp_request_token")
        code = (request.data.get("code") or "").strip()

        if not otp_request_token or len(code) != 6:
            return Response({"message": "OTP request token and code are required."}, status=400)

        try:
            otp = AuthOtp.objects.select_related("user").get(
                otp_request_token=otp_request_token,
                purpose="login",
                is_active=True,
                used_at__isnull=True,
            )
        except AuthOtp.DoesNotExist:
            return Response({"message": "OTP not found or already used."}, status=404)

        now = timezone.now()

        if otp.expires_at <= now:
            otp.is_active = False
            otp.updated_at = now
            otp.save(update_fields=["is_active", "updated_at"])
            return Response({"message": "OTP expired."}, status=400)

        if otp.attempts >= otp.max_attempts:
            otp.is_active = False
            otp.updated_at = now
            otp.save(update_fields=["is_active", "updated_at"])
            return Response({"message": "Maximum attempts reached."}, status=400)

        otp.attempts += 1
        otp.updated_at = now
        otp.save(update_fields=["attempts", "updated_at"])

        if _hash_value(code) != otp.otp_hash:
            return Response({"message": "Invalid OTP."}, status=400)

        otp.is_active = False
        otp.used_at = now
        otp.updated_at = now
        otp.save(update_fields=["is_active", "used_at", "updated_at"])

        auth_session = _create_session_for_user(otp.user, request)

        return Response({
            "message": "Sign in successful.",
            "redirect_url": _get_dashboard_redirect_for_user(otp.user),
            "session_request_token": str(auth_session.session_request_token),
            "session_token_hint": auth_session.token_hint,
        })


# =========================
# AUTH - ADMIN SIGNIN
# =========================
class AdminSigninRequestOtpAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        login = (request.data.get("login") or "").strip()
        password = (request.data.get("password") or "")

        if not login or not password:
            return Response({"message": "Admin username and admin key are required."}, status=400)

        try:
            user = UserManagement.objects.get(
                Q(email__iexact=login) | Q(username__iexact=login),
                is_active=True,
                role="admin",
            )
        except UserManagement.DoesNotExist:
            return Response({"message": "Admin account not found."}, status=404)

        try:
            valid_password = bcrypt.checkpw(
                password.encode("utf-8"),
                (user.password_hash or "").encode("utf-8")
            )
        except Exception:
            valid_password = False

        if not valid_password:
            return Response({"message": "Invalid admin credentials."}, status=400)

        if not user.verified:
            return Response({"message": "This admin email is not verified yet."}, status=403)

        if user.status != "active":
            return Response({"message": "This admin account is not active."}, status=403)

        otp, error = _create_demo_otp(user, "login", code="123456")
        if not otp:
            return Response({"message": f"Admin demo OTP could not be created: {error}"}, status=500)

        return Response({
            "message": "Demo admin OTP created.",
            "otp_request_token": str(otp.otp_request_token),
            "expires_at": otp.expires_at.isoformat(),
        }, status=200)


class AdminSigninVerifyOtpAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        otp_request_token = request.data.get("otp_request_token")
        code = (request.data.get("code") or "").strip()

        if not otp_request_token or len(code) != 6:
            return Response({"message": "OTP request token and 6-digit code are required."}, status=400)

        try:
            otp = AuthOtp.objects.select_related("user").get(
                otp_request_token=otp_request_token,
                purpose="login",
                is_active=True,
                used_at__isnull=True,
            )
        except AuthOtp.DoesNotExist:
            return Response({"message": "Admin OTP not found or already used."}, status=404)

        now = timezone.now()

        if otp.expires_at <= now:
            otp.is_active = False
            otp.updated_at = now
            otp.save(update_fields=["is_active", "updated_at"])
            return Response({"message": "Admin OTP expired."}, status=400)

        if otp.user.role != "admin":
            otp.is_active = False
            otp.updated_at = now
            otp.save(update_fields=["is_active", "updated_at"])
            return Response({"message": "Unauthorized OTP scope."}, status=403)

        if otp.attempts >= otp.max_attempts:
            otp.is_active = False
            otp.updated_at = now
            otp.save(update_fields=["is_active", "updated_at"])
            return Response({"message": "Maximum OTP attempts reached."}, status=400)

        otp.attempts += 1
        otp.updated_at = now
        otp.save(update_fields=["attempts", "updated_at"])

        if _hash_value(code) != otp.otp_hash:
            return Response({"message": "Invalid admin verification code."}, status=400)

        otp.is_active = False
        otp.used_at = now
        otp.updated_at = now
        otp.save(update_fields=["is_active", "used_at", "updated_at"])

        _create_session_for_user(otp.user, request)

        return Response({
            "message": "Admin authentication successful.",
            "redirect_url": _get_dashboard_redirect_for_user(otp.user),
        }, status=200)


class AdminSigninResendOtpAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        login = (request.data.get("login") or "").strip()

        if not login:
            return Response({"message": "Admin login is required."}, status=400)

        try:
            user = UserManagement.objects.get(
                Q(email__iexact=login) | Q(username__iexact=login),
                is_active=True,
                role="admin",
            )
        except UserManagement.DoesNotExist:
            return Response({"message": "Admin account not found."}, status=404)

        if not user.verified:
            return Response({"message": "This admin email is not verified yet."}, status=403)

        if user.status != "active":
            return Response({"message": "This admin account is not active."}, status=403)

        otp, error = _create_demo_otp(user, "login", code="123456")
        if not otp:
            return Response({"message": f"Could not resend admin demo OTP: {error}"}, status=500)

        return Response({
            "message": "A fresh demo admin OTP is ready.",
            "otp_request_token": str(otp.otp_request_token),
            "expires_at": otp.expires_at.isoformat(),
        }, status=200)


class AuthLogoutAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        revoked_count = _revoke_current_auth_session(request)
        request.session.flush()

        response = Response({
            "message": "Logged out successfully.",
            "redirect_url": "/signin/",
            "revoked_sessions": revoked_count,
        }, status=200)
        response["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response["Pragma"] = "no-cache"
        response["Expires"] = "0"
        return response


class CurrentUserAPIView(APIView):
    authentication_classes = [DashboardSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserManagementSerializer(request.user).data)
