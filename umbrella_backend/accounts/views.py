from django.shortcuts import render

# Create your views here.

def login_view(request):
    return render(request, 'auth.html')

def home_view(request):
    return render(request, 'index.html')