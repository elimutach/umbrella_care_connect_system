from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone

# Create your models here.
class Need(models.Model):
    class PriorityChoices(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        URGENT = "urgent", "Urgent"

    class StatusChoices(models.TextChoices):
        OPEN = "open", "Open"
        PARTIAL = "partial", "Partially Fulfilled"
        FULFILLED = "fulfilled", "Fulfilled"
        CLOSED = "closed", "Closed"

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    category = models.CharField(max_length=100, blank=True, null=True)
    quantity_required = models.PositiveIntegerField()
    quantity_fulfilled = models.PositiveIntegerField(default=0)
    priority = models.CharField(
        max_length=20,
        choices=PriorityChoices.choices,
        default=PriorityChoices.MEDIUM,
    )
    deadline = models.DateField(blank=True, null=True)
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.OPEN,
    )
    posted_by_name = models.CharField(max_length=150, blank=True, null=True)
    is_closed = models.BooleanField(default=False)
    closed_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title

    @property
    def quantity_remaining(self):
        return max(self.quantity_required - self.quantity_fulfilled, 0)

    def clean(self):
        if self.quantity_required <= 0:
            raise ValidationError("Quantity required must be greater than 0.")
        if self.quantity_fulfilled > self.quantity_required:
            raise ValidationError("Quantity fulfilled cannot be greater than quantity required.")

    def update_status(self):
        if self.is_closed:
            self.status = self.StatusChoices.CLOSED
        elif self.quantity_fulfilled == 0:
            self.status = self.StatusChoices.OPEN
        elif self.quantity_fulfilled < self.quantity_required:
            self.status = self.StatusChoices.PARTIAL
        else:
            self.status = self.StatusChoices.FULFILLED

    def save(self, *args, **kwargs):
        if self.is_closed and not self.closed_at:
            self.closed_at = timezone.now()
        if not self.is_closed:
            self.closed_at = None

        self.full_clean()
        self.update_status()
        super().save(*args, **kwargs)