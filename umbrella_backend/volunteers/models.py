from django.conf import settings
from django.db import models
from django.utils import timezone
import uuid


class VolunteerProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="volunteer_profile",
    )
    phone = models.CharField(max_length=20, blank=True)
    skills = models.TextField(blank=True)
    availability = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return getattr(self.user, "email", str(self.user))


class VolunteerEvent(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    event_date = models.DateTimeField()
    location = models.CharField(max_length=255, blank=True)
    slots_total = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_volunteer_events",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def slots_taken(self):
        return self.signups.exclude(status=VolunteerSignup.Status.CANCELLED).count()

    @property
    def slots_remaining(self):
        remaining = self.slots_total - self.slots_taken
        return remaining if remaining > 0 else 0

    @property
    def is_past(self):
        return self.event_date < timezone.now()

    def __str__(self):
        return self.title


class VolunteerSignup(models.Model):
    class Status(models.TextChoices):
        CONFIRMED = "confirmed", "Confirmed"
        CANCELLED = "cancelled", "Cancelled"
        ATTENDED = "attended", "Attended"

    event = models.ForeignKey(
        VolunteerEvent,
        on_delete=models.CASCADE,
        related_name="signups",
    )
    volunteer = models.ForeignKey(
        VolunteerProfile,
        on_delete=models.CASCADE,
        related_name="signups",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.CONFIRMED,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["event", "volunteer"],
                name="unique_volunteer_event_signup",
            )
        ]

    def __str__(self):
        return f"{self.volunteer} -> {self.event}"
    
class VolunteerActivity(models.Model):
    id = models.UUIDField(primary_key=True)
    slug = models.TextField(unique=True)
    title = models.TextField()
    description = models.TextField(blank=True, null=True)
    image_url = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()
    number_of_volunteers = models.DecimalField(max_digits=12, decimal_places=0, default=0)

    class Meta:
        managed = False
        db_table = "volunteer_activities"

    def __str__(self):
        return self.title


class VolunteerApplication(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application_code = models.TextField(blank=True, null=True, unique=True)
    first_name = models.TextField()
    last_name = models.TextField()
    phone = models.TextField()
    email = models.TextField()
    county = models.TextField()
    id_passport = models.TextField()
    passport_photo_url = models.TextField(blank=True, null=True)
    activity = models.ForeignKey(
        VolunteerActivity,
        on_delete=models.DO_NOTHING,
        db_column="activity_id",
        related_name="applications",
        db_constraint=False,
    )
    status = models.TextField(default="pending")
    source = models.TextField(default="website")
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = "volunteer_applications"

    def __str__(self):
        return self.application_code or str(self.id)


class VolunteerApplicationLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(
        VolunteerApplication,
        on_delete=models.DO_NOTHING,
        db_column="application_id",
        related_name="logs",
        db_constraint=False,
    )
    action = models.TextField()
    actor = models.TextField(default="system")
    metadata = models.JSONField(default=dict)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = "volunteer_application_logs"


class VolunteerDashboardEvent(models.Model):
    id = models.BigAutoField(primary_key=True)
    title = models.CharField(max_length=200)
    description = models.TextField()
    event_date = models.DateTimeField()
    location = models.CharField(max_length=255)
    slots_total = models.IntegerField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    created_by_id = models.IntegerField(blank=True, null=True, db_column="created_by_id")

    class Meta:
        managed = False
        db_table = "volunteers_volunteerevent"

    def __str__(self):
        return self.title