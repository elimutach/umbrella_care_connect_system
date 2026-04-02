import json
from datetime import date

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import Need


def needs_page(request):
    return render(request, "needs.html")


def serialize_need(need):
    return {
        "id": need.id,
        "title": need.title,
        "description": need.description,
        "category": need.category,
        "quantity_required": need.quantity_required,
        "quantity_fulfilled": need.quantity_fulfilled,
        "quantity_remaining": need.quantity_remaining,
        "priority": need.priority,
        "deadline": need.deadline.isoformat() if need.deadline else None,
        "status": need.status,
        "posted_by_name": need.posted_by_name,
        "is_closed": need.is_closed,
        "closed_at": need.closed_at.isoformat() if need.closed_at else None,
        "created_at": need.created_at.isoformat(),
        "updated_at": need.updated_at.isoformat(),
    }


def parse_body(request):
    try:
        return json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return None


@csrf_exempt
@require_http_methods(["GET", "POST"])
def needs_api(request):
    if request.method == "GET":
        needs = Need.objects.all()

        status_value = request.GET.get("status")
        category_value = request.GET.get("category")
        priority_value = request.GET.get("priority")
        search_value = request.GET.get("search")

        if status_value:
            needs = needs.filter(status=status_value)
        if category_value:
            needs = needs.filter(category__iexact=category_value)
        if priority_value:
            needs = needs.filter(priority=priority_value)
        if search_value:
            needs = needs.filter(title__icontains=search_value)

        return JsonResponse({
            "count": needs.count(),
            "results": [serialize_need(n) for n in needs]
        })

    data = parse_body(request)
    if data is None:
        return JsonResponse({"error": "Invalid JSON body."}, status=400)

    try:
        deadline = None
        if data.get("deadline"):
            deadline = date.fromisoformat(data["deadline"])

        need = Need.objects.create(
            title=data.get("title", "").strip(),
            description=data.get("description", ""),
            category=data.get("category"),
            quantity_required=int(data.get("quantity_required", 0)),
            quantity_fulfilled=int(data.get("quantity_fulfilled", 0)),
            priority=data.get("priority", "medium"),
            deadline=deadline,
            posted_by_name=data.get("posted_by_name"),
        )
        return JsonResponse({"message": "Need created successfully.", "need": serialize_need(need)}, status=201)

    except (ValueError, ValidationError) as e:
        return JsonResponse({"error": str(e)}, status=400)


@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
def need_detail_api(request, need_id):
    need = get_object_or_404(Need, pk=need_id)

    if request.method == "GET":
        return JsonResponse(serialize_need(need))

    if request.method == "PATCH":
        data = parse_body(request)
        if data is None:
            return JsonResponse({"error": "Invalid JSON body."}, status=400)

        try:
            if "title" in data:
                need.title = data["title"].strip()
            if "description" in data:
                need.description = data["description"]
            if "category" in data:
                need.category = data["category"]
            if "quantity_required" in data:
                need.quantity_required = int(data["quantity_required"])
            if "quantity_fulfilled" in data:
                need.quantity_fulfilled = int(data["quantity_fulfilled"])
            if "priority" in data:
                need.priority = data["priority"]
            if "deadline" in data:
                need.deadline = date.fromisoformat(data["deadline"]) if data["deadline"] else None
            if "posted_by_name" in data:
                need.posted_by_name = data["posted_by_name"]

            need.save()
            return JsonResponse({"message": "Need updated successfully.", "need": serialize_need(need)})

        except (ValueError, ValidationError) as e:
            return JsonResponse({"error": str(e)}, status=400)

    need.delete()
    return JsonResponse({"message": "Need deleted successfully."})


@csrf_exempt
@require_http_methods(["POST"])
def close_need_api(request, need_id):
    need = get_object_or_404(Need, pk=need_id)
    need.is_closed = True
    need.closed_at = timezone.now()
    need.save()

    return JsonResponse({"message": "Need closed successfully.", "need": serialize_need(need)})