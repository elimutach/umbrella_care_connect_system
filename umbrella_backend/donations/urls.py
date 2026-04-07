from django.urls import path
from .views import (
    donation_list_view,
    donation_create_view,
    donation_api_list,
    donation_api_stats,
    donation_api_detail,
    donor_needs_api,
    donor_history_api,
    donor_stats_api,
    donor_submit_donation_api,
    donor_pledges_api,
)

urlpatterns = [
    path("", donation_list_view, name="donation_list"),
    path("new/", donation_create_view, name="donation_create"),

    path("api/donations/", donation_api_list, name="donation_api_list"),
    path("api/donations/stats/", donation_api_stats, name="donation_api_stats"),
    path("api/donations/<uuid:donation_id>/", donation_api_detail, name="donation_api_detail"),

    path("api/donor/needs/", donor_needs_api, name="donor_needs_api"),
    path("api/donor/history/", donor_history_api, name="donor_history_api"),
    path("api/donor/stats/", donor_stats_api, name="donor_stats_api"),
    path("api/donor/submit/", donor_submit_donation_api, name="donor_submit_donation_api"),
    path("api/donor/pledges/", donor_pledges_api, name="donor_pledges_api"),
]
