import uuid
from django.db import models
from django.db.models import Value
from django.db.models.functions import Coalesce, Concat, Trim
from django.utils.timesince import timesince


class UserManagement(models.Model):
    ROLE_CHOICES = [
        ("admin", "Admin"),
        ("donor", "Donor"),
        ("volunteer", "Volunteer"),
    ]

    STATUS_CHOICES = [
        ("active", "Active"),
        ("paused", "Paused"),
        ("terminated", "Terminated"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100, blank=True, null=True)
    full_name = models.GeneratedField(
        expression=Trim(
            Concat(
                Coalesce("first_name", Value("")),
                Value(" "),
                Coalesce("last_name", Value("")),
            )
        ),
        output_field=models.CharField(max_length=220),
        db_persist=True,
    )
    username = models.CharField(max_length=100, unique=True)
    email = models.EmailField(max_length=255, unique=True)
    phone = models.CharField(max_length=30, blank=True, null=True)
    password_hash = models.CharField(max_length=255)
    profile_photo = models.TextField(blank=True, null=True)
    reg_code = models.CharField(max_length=20, unique=True)

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="donor")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="paused")
    verified = models.BooleanField(default=False)

    current_session_key = models.CharField(max_length=255, blank=True, null=True)
    last_seen = models.DateTimeField(blank=True, null=True)
    sign_in_count = models.IntegerField(default=0)
    forgot_password_change_count = models.IntegerField(default=0)

    is_active = models.BooleanField(default=True)
    suspended_at = models.DateTimeField(blank=True, null=True)
    terminated_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    verified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "user_management"
        ordering = ["-created_at"]

    @property
    def last_seen_human(self):
        if not self.last_seen:
            return "-"
        return f"{timesince(self.last_seen)} ago"

    @property
    def is_authenticated(self):
        return True
    
    def __str__(self):
        return self.username


class DonorProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        UserManagement,
        on_delete=models.CASCADE,
        related_name="donor_profile",
        db_column="user_id",
    )
    country = models.CharField(max_length=120, blank=True, null=True)
    city = models.CharField(max_length=120, blank=True, null=True)
    gender = models.CharField(max_length=50, blank=True, null=True)
    donor_type = models.CharField(max_length=50, blank=True, null=True)
    donation_preference = models.CharField(max_length=50, blank=True, null=True)
    donor_note = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "donor_profile"
        ordering = ["-created_at"]

    def __str__(self):
        return f"DonorProfile({self.user.username})"


class VolunteerProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        UserManagement,
        on_delete=models.CASCADE,
        related_name="volunteer_profile",
        db_column="user_id",
    )
    country = models.CharField(max_length=120, blank=True, null=True)
    city = models.CharField(max_length=120, blank=True, null=True)
    gender = models.CharField(max_length=50, blank=True, null=True)
    skills = models.TextField(blank=True, null=True)
    availability = models.JSONField(default=list, blank=True)
    areas_of_interest = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "volunteer_profile"
        ordering = ["-created_at"]

    def __str__(self):
        return f"VolunteerProfile({self.user.username})"


class AuthOtp(models.Model):
    PURPOSE_CHOICES = [
        ("login", "Login"),
        ("email_verification", "Email Verification"),
        ("password_reset", "Password Reset"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    otp_request_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    user = models.ForeignKey(
        UserManagement,
        on_delete=models.CASCADE,
        related_name="auth_otps",
        db_column="user_id",
    )
    purpose = models.CharField(max_length=40, choices=PURPOSE_CHOICES)
    otp_hash = models.CharField(max_length=255)
    email_snapshot = models.EmailField(max_length=255, blank=True, null=True)
    code_last2 = models.CharField(max_length=2, blank=True, null=True)
    attempts = models.IntegerField(default=0)
    max_attempts = models.IntegerField(default=5)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "auth_otps"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} - {self.purpose}"


class AuthSession(models.Model):
    STATUS_CHOICES = [
        ("active", "Active"),
        ("expired", "Expired"),
        ("used", "Used"),
        ("revoked", "Revoked"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session_request_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    user = models.ForeignKey(
        UserManagement,
        on_delete=models.CASCADE,
        related_name="auth_sessions",
        db_column="user_id",
    )
    session_key_hash = models.CharField(max_length=255)
    token_hint = models.CharField(max_length=10, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()
    last_seen_at = models.DateTimeField(blank=True, null=True)
    expires_at = models.DateTimeField()
    ended_at = models.DateTimeField(blank=True, null=True)
    active_duration_seconds = models.IntegerField(default=0)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        managed = False
        db_table = "auth_sessions"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} - {self.status}"