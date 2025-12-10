from __future__ import annotations

import json
import mimetypes
import os
import secrets
import unicodedata
from pathlib import Path
from datetime import datetime

from dotenv import load_dotenv

try:
    from googletrans import Translator  # type: ignore
except ImportError:
    Translator = None

try:
    from deep_translator import GoogleTranslator  # type: ignore
except Exception:
    GoogleTranslator = None

from flask import (
    Flask,
    abort,
    flash,
    g,
    redirect,
    render_template,
    request,
    send_from_directory,
    session,
    url_for,
)
from flask_login import (
    LoginManager,
    UserMixin,
    current_user,
    login_required,
    login_user,
    logout_user,
)
from flask_sqlalchemy import SQLAlchemy
from flask_wtf import FlaskForm
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename
from wtforms import BooleanField, DecimalField, FileField, IntegerField, PasswordField, SelectField, StringField, TextAreaField
from wtforms.validators import DataRequired, Email, EqualTo, Length, NumberRange
import qrcode
from googletrans import Translator

# Paths
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_ROOT = BASE_DIR / "uploads"
LOGO_FOLDER = UPLOAD_ROOT / "logos"
DISH_FOLDER = UPLOAD_ROOT / "dishes"
QR_FOLDER = UPLOAD_ROOT / "qr"
load_dotenv(BASE_DIR / ".env")
for folder in (UPLOAD_ROOT, LOGO_FOLDER, DISH_FOLDER, QR_FOLDER):
    folder.mkdir(parents=True, exist_ok=True)
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("application/pdf", ".pdf")

LANGUAGES = {
    "ru": "Русский",
    "en": "English",
    "hy": "Հայերեն",
    "ar": "العربية",
    "es": "Español",
    "de": "Deutsch",
    "hi": "हिन्दी",
}

DEFAULT_LANG = os.environ.get("DEFAULT_LANG", "hy")
ADMIN_EMAILS = {email.strip().lower() for email in os.environ.get("ADMIN_EMAILS", "").split(",") if email.strip()}

TRANSLATIONS = {
    "ru": {
        "search": "Поиск по блюдам",
        "category": "Категория",
        "no_dishes": "Пока нет блюд.",
        "empty_menu": "Меню пока пусто.",
        "not_available": "Нет в наличии",
    },
    "en": {
        "search": "Search dishes",
        "category": "Category",
        "no_dishes": "No dishes yet.",
        "empty_menu": "Menu is empty.",
        "not_available": "Not available",
    },
    "hy": {
        "search": "Որոնել ուտեստ",
        "category": "Կատեգորիա",
        "no_dishes": "Դեռևս ուտեստներ չկան։",
        "empty_menu": "Մենյուն դատարկ է։",
        "not_available": "Առկա չէ",
    },
    "ar": {
        "search": "ابحث عن الأطباق",
        "category": "فئة",
        "no_dishes": "لا توجد أطباق بعد.",
        "empty_menu": "القائمة فارغة.",
        "not_available": "غير متوفر",
    },
    "es": {
        "search": "Buscar platos",
        "category": "Categoría",
        "no_dishes": "Aún no hay platos.",
        "empty_menu": "El menú está vacío.",
        "not_available": "No disponible",
    },
    "de": {
        "search": "Gerichte suchen",
        "category": "Kategorie",
        "no_dishes": "Noch keine Gerichte.",
        "empty_menu": "Menü ist leer.",
        "not_available": "Nicht verfügbar",
    },
    "hi": {
        "search": "व्यंजन खोजें",
        "category": "श्रेणी",
        "no_dishes": "अभी तक कोई व्यंजन नहीं।",
        "empty_menu": "मेनू खाली है।",
        "not_available": "उपलब्ध नहीं",
    },
}

CURRENCY_SYMBOLS = {
    "AMD": "֏",
    "USD": "$",
    "EUR": "€",
    "RUB": "₽",
    "GBP": "£",
}

REQUEST_STATUS = ("new", "seen")

UI_TRANSLATIONS = {
    "ru": {
        "login": "Войти",
        "register": "Регистрация",
        "logout": "Выйти",
        "admin": "Админка",
        "all_users": "Все пользователи",
        "all_restaurants": "Все рестораны",
        "owner": "Владелец",
        "created": "Создано",
        "email": "Email",
        "password": "Пароль",
        "confirm_password": "Подтверждение пароля",
        "no_account": "Нет аккаунта?",
        "have_account": "Уже зарегистрированы?",
        "create_account": "Создать аккаунт",
        "dashboard": "Личный кабинет",
        "my_restaurants": "Мои рестораны",
        "new_restaurant": "Новый ресторан",
        "no_description": "Нет описания",
        "manage": "Управление",
        "public_menu": "Публичное меню",
        "qr_code": "QR-код",
        "restaurant_form_new": "Новый ресторан",
        "restaurant_form_edit": "Редактировать ресторан",
        "no_restaurants": "Пока нет ресторанов. Создайте первый.",
        "name": "Название",
        "description": "Описание",
        "logo": "Логотип",
        "save": "Сохранить",
        "cancel": "Отмена",
        "back": "Назад",
        "categories": "Категории",
        "drag_hint": "Перетаскивайте, чтобы менять порядок",
        "add_category": "+ Категория",
        "order": "Порядок",
        "edit": "Редактировать",
        "delete": "Удалить",
        "add_dish": "+ Блюдо",
        "no_dishes": "Пока нет блюд.",
        "category_title": "Категория для",
        "dish_title": "Блюдо в категории",
        "price": "Цена",
        "currency": "Валюта",
        "available": "В наличии",
        "file_not_selected": "Файл не выбран",
        "upload_hint": "Перетащите файл или нажмите",
        "public_link": "Публичная ссылка",
        "language": "Язык",
        "translations": "Переводы",
        "translation_hint": "Укажите названия и описания для других языков (опционально)",
        "download": "Скачать",
        "no_users": "Пока нет пользователей",
        "user_exists": "Пользователь с таким email уже существует",
        "account_created": "Аккаунт создан, войдите",
        "bad_credentials": "Неверный email или пароль",
        "logged_out": "Вы вышли из аккаунта",
        "restaurant_created": "Ресторан создан",
        "restaurant_updated": "Ресторан обновлен",
        "category_added": "Категория добавлена",
        "category_updated": "Категория обновлена",
        "category_deleted": "Категория удалена",
        "dish_added": "Блюдо добавлено",
        "dish_updated": "Блюдо обновлено",
        "dish_deleted": "Блюдо удалено",
        "login_hero_pre": "QR меню без ожидания",
        "login_hero_title": "Создайте цифровое меню и делитесь QR-кодом",
        "login_hero_sub": "Добавляйте рестораны, категории и блюда, генерируйте QR для гостей. Всё управляется из одного кабинета.",
        "register_hero_pre": "Быстрый старт",
        "register_hero_title": "Заведите аккаунт и запустите меню за 5 минут",
        "register_hero_sub": "Логотипы, блюда и QR — в одном интерфейсе.",
        "tables": "Столы",
        "add_table": "+ Стол",
        "table_number": "Номер стола",
        "table_added": "Стол добавлен",
        "table_deleted": "Стол удален",
        "table_exists": "Такой номер уже есть",
        "no_tables": "Столы не добавлены",
        "add_to_cart": "Добавить",
        "call_waiter": "Позвать официанта",
        "table_label": "Стол",
        "cart_items": "товаров",
        "clear_cart": "Очистить",
        "no_requests": "Пока нет вызовов",
        "new": "Новое",
        "call_waiter_sent": "Вызов отправлен",
        "call_waiter_error": "Не удалось отправить вызов",
    },
    "en": {
        "login": "Log in",
        "register": "Sign up",
        "logout": "Log out",
        "admin": "Admin",
        "all_users": "All users",
        "all_restaurants": "All restaurants",
        "owner": "Owner",
        "created": "Created",
        "email": "Email",
        "password": "Password",
        "confirm_password": "Confirm password",
        "no_account": "No account?",
        "have_account": "Already registered?",
        "create_account": "Create account",
        "dashboard": "Dashboard",
        "my_restaurants": "My restaurants",
        "new_restaurant": "New restaurant",
        "no_description": "No description",
        "manage": "Manage",
        "public_menu": "Public menu",
        "qr_code": "QR code",
        "restaurant_form_new": "New restaurant",
        "restaurant_form_edit": "Edit restaurant",
        "no_restaurants": "No restaurants yet. Create the first one.",
        "name": "Name",
        "description": "Description",
        "logo": "Logo",
        "save": "Save",
        "cancel": "Cancel",
        "back": "Back",
        "categories": "Categories",
        "drag_hint": "Drag to reorder",
        "add_category": "+ Category",
        "order": "Order",
        "edit": "Edit",
        "delete": "Delete",
        "add_dish": "+ Dish",
        "no_dishes": "No dishes yet.",
        "category_title": "Category for",
        "dish_title": "Dish in category",
        "price": "Price",
        "currency": "Currency",
        "available": "Available",
        "file_not_selected": "No file selected",
        "upload_hint": "Drag a file or click",
        "public_link": "Public link",
        "language": "Language",
        "translations": "Translations",
        "translation_hint": "Provide name and description for other languages (optional)",
        "download": "Download",
        "no_users": "No users yet",
        "user_exists": "A user with this email already exists",
        "account_created": "Account created, please log in",
        "bad_credentials": "Invalid email or password",
        "logged_out": "You have logged out",
        "restaurant_created": "Restaurant created",
        "restaurant_updated": "Restaurant updated",
        "category_added": "Category added",
        "category_updated": "Category updated",
        "category_deleted": "Category deleted",
        "dish_added": "Dish added",
        "dish_updated": "Dish updated",
        "dish_deleted": "Dish deleted",
        "login_hero_pre": "QR menu without waiting",
        "login_hero_title": "Create a digital menu and share QR codes",
        "login_hero_sub": "Add restaurants, categories and dishes, generate QR for guests from one dashboard.",
        "register_hero_pre": "Fast start",
        "register_hero_title": "Launch your menu in 5 minutes",
        "register_hero_sub": "Logos, dishes and QR — all in one interface.",
        "tables": "Tables",
        "add_table": "+ Table",
        "table_number": "Table number",
        "table_added": "Table added",
        "table_deleted": "Table deleted",
        "table_exists": "This number already exists",
        "no_tables": "No tables yet",
        "add_to_cart": "Add",
        "call_waiter": "Call waiter",
        "table_label": "Table",
        "cart_items": "items",
        "clear_cart": "Clear",
        "no_requests": "No requests yet",
        "new": "New",
        "call_waiter_sent": "Request sent",
        "call_waiter_error": "Failed to send request",
    },
    "hy": {
        "login": "Մուտք",
        "register": "Գրանցում",
        "logout": "Ելք",
        "admin": "Ադմին",
        "all_users": "Բոլոր օգտատերերը",
        "all_restaurants": "Բոլոր ռեստորանները",
        "owner": "Սեփականատեր",
        "created": "Ստեղծված է",
        "email": "Էլ.փոստ",
        "password": "Գաղտնաբառ",
        "confirm_password": "Հաստատեք գաղտնաբառը",
        "no_account": "Չունե՞ք հաշիվ",
        "have_account": "Արդեն գրանցվա՞ծ եք",
        "create_account": "Ստեղծել հաշիվ",
        "dashboard": "Կառավարում",
        "my_restaurants": "Իմ ռեստորանները",
        "new_restaurant": "Նոր ռեստորան",
        "no_description": "Նկարագրություն չկա",
        "manage": "Կառավարել",
        "public_menu": "Հանրային մենյու",
        "qr_code": "QR կոդ",
        "restaurant_form_new": "Նոր ռեստորան",
        "restaurant_form_edit": "Խմբագրել ռեստորանը",
        "no_restaurants": "Դեռ ռեստորաններ չկան։ Ավելացրեք առաջինը։",
        "name": "Անուն",
        "description": "Նկարագրություն",
        "logo": "Լոգո",
        "save": "Պահպանել",
        "cancel": "Չեղարկել",
        "back": "Վերադարձ",
        "categories": "Կատեգորիաներ",
        "drag_hint": "Քաշեք՝ կարգը փոխելու համար",
        "add_category": "+ Կատեգորիա",
        "order": "Կարգ",
        "edit": "Խմբագրել",
        "delete": "Հեռացնել",
        "add_dish": "+ Ուտեստ",
        "no_dishes": "Դեռ ուտեստներ չկան։",
        "category_title": "Կատեգորիա՝",
        "dish_title": "Ուտեստ կատեգորիայում",
        "price": "Գին",
        "currency": "Արժույթ",
        "available": "Առկա է",
        "file_not_selected": "Ֆայլը ընտրված չէ",
        "upload_hint": "Քաշեք ֆայլը կամ սեղմեք",
        "public_link": "Հանրային հղում",
        "language": "Լեզու",
        "translations": "Թարգմանություններ",
        "translation_hint": "Լրացրեք անվանումը և նկարագրությունը այլ լեզուներով (ըստ ցանկության)",
        "download": "Ներբեռնել",
        "no_users": "Դեռ օգտատերեր չկան",
        "user_exists": "Այդ էլ․փոստով օգտվող արդեն կա",
        "account_created": "Հաշիվը ստեղծված է, մուտք գործեք",
        "bad_credentials": "Սխալ էլ․փոստ կամ գաղտնաբառ",
        "logged_out": "Դուրս եկաք հաշվից",
        "restaurant_created": "Ռեստորանը ստեղծվեց",
        "restaurant_updated": "Ռեստորանը թարմացվեց",
        "category_added": "Կատեգորիան ավելացվեց",
        "category_updated": "Կատեգորիան թարմացվեց",
        "category_deleted": "Կատեգորիան ջնջվեց",
        "dish_added": "Ուտեստը ավելացվեց",
        "dish_updated": "Ուտեստը թարմացվեց",
        "dish_deleted": "Ուտեստը ջնջվեց",
        "login_hero_pre": "QR մենյու՝ առանց սպասելու",
        "login_hero_title": "Ստեղծեք թվային մենյուն և կիսվեք QR-ով",
        "login_hero_sub": "Լոգոներ, կատեգորիաներ և ուտեստներ, QR կոդեր՝ մեկ կառավարման էջում։",
        "register_hero_pre": "Արագ start",
        "register_hero_title": "Գործարկեք մենյուն 5 րոպեում",
        "register_hero_sub": "Լոգո, ուտեստներ և QR՝ մեկ ինտերֆեյսում։",
        "tables": "Սեղաններ",
        "add_table": "+ Սեղան",
        "table_number": "Սեղանի համար",
        "table_added": "Սեղանը ավելացվեց",
        "table_deleted": "Սեղանը ջնջվեց",
        "table_exists": "Այդ համարը արդեն կա",
        "no_tables": "Սեղաններ չկան",
        "add_to_cart": "Ավելացնել",
        "call_waiter": "Կանչել մատուցողին",
        "table_label": "Սեղան",
        "cart_items": "պատվեր",
        "clear_cart": "Մաքրել",
        "no_requests": "Դեռ կանչեր չկան",
        "new": "Նոր",
        "call_waiter_sent": "Կանչը ուղարկվեց",
        "call_waiter_error": "Չհաջողվեց ուղարկել կանչը",
    },
    "ar": {
        "login": "تسجيل الدخول",
        "register": "إنشاء حساب",
        "logout": "تسجيل الخروج",
        "admin": "إدارة",
        "all_users": "كل المستخدمين",
        "all_restaurants": "كل المطاعم",
        "owner": "المالك",
        "created": "تم الإنشاء",
        "email": "البريد الإلكتروني",
        "password": "كلمة المرور",
        "confirm_password": "تأكيد كلمة المرور",
        "no_account": "لا تملك حساباً؟",
        "have_account": "مسجل بالفعل؟",
        "create_account": "إنشاء حساب",
        "dashboard": "لوحة التحكم",
        "my_restaurants": "مطاعمي",
        "new_restaurant": "مطعم جديد",
        "no_description": "لا يوجد وصف",
        "manage": "إدارة",
        "public_menu": "قائمة عامة",
        "qr_code": "رمز QR",
        "restaurant_form_new": "مطعم جديد",
        "restaurant_form_edit": "تعديل المطعم",
        "no_restaurants": "لا توجد مطاعم بعد. أضف الأول.",
        "name": "الاسم",
        "description": "الوصف",
        "logo": "الشعار",
        "save": "حفظ",
        "cancel": "إلغاء",
        "back": "رجوع",
        "categories": "الفئات",
        "drag_hint": "اسحب لتغيير الترتيب",
        "add_category": "+ فئة",
        "order": "الترتيب",
        "edit": "تعديل",
        "delete": "حذف",
        "add_dish": "+ طبق",
        "no_dishes": "لا توجد أطباق بعد.",
        "category_title": "فئة لـ",
        "dish_title": "طبق في الفئة",
        "price": "السعر",
        "currency": "العملة",
        "available": "متوفر",
        "file_not_selected": "لم يتم اختيار ملف",
        "upload_hint": "اسحب ملفاً أو اضغط",
        "public_link": "رابط عام",
        "language": "اللغة",
        "translations": "الترجمات",
        "translation_hint": "أضف الاسم والوصف بلغات أخرى (اختياري)",
        "download": "تنزيل",
        "no_users": "لا يوجد مستخدمون بعد",
        "user_exists": "المستخدم موجود بالفعل",
        "account_created": "تم إنشاء الحساب، يرجى تسجيل الدخول",
        "bad_credentials": "بريد إلكتروني أو كلمة مرور غير صحيحة",
        "logged_out": "تم تسجيل الخروج",
        "restaurant_created": "تم إنشاء المطعم",
        "restaurant_updated": "تم تحديث المطعم",
        "category_added": "تمت إضافة الفئة",
        "category_updated": "تم تحديث الفئة",
        "category_deleted": "تم حذف الفئة",
        "dish_added": "تمت إضافة الطبق",
        "dish_updated": "تم تحديث الطبق",
        "dish_deleted": "تم حذف الطبق",
        "login_hero_pre": "قائمة QR بدون انتظار",
        "login_hero_title": "أنشئ قائمة رقمية وشارك رموز QR",
        "login_hero_sub": "أضف المطاعم والفئات والأطباق وأنشئ رموز QR في لوحة واحدة.",
        "register_hero_pre": "انطلاق سريع",
        "register_hero_title": "أطلق قائمتك خلال 5 دقائق",
        "register_hero_sub": "شعارات وأطباق وQR في واجهة واحدة.",
        "tables": "الطاولات",
        "add_table": "+ طاولة",
        "table_number": "رقم الطاولة",
        "table_added": "تمت إضافة الطاولة",
        "table_deleted": "تم حذف الطاولة",
        "table_exists": "هذا الرقم موجود بالفعل",
        "no_tables": "لا توجد طاولات بعد",
        "add_to_cart": "إضافة",
        "call_waiter": "نداء النادل",
        "table_label": "طاولة",
        "cart_items": "عناصر",
    },
    "es": {
        "login": "Iniciar sesión",
        "register": "Registrarse",
        "logout": "Cerrar sesión",
        "admin": "Admin",
        "all_users": "Todos los usuarios",
        "all_restaurants": "Todos los restaurantes",
        "owner": "Propietario",
        "created": "Creado",
        "email": "Email",
        "password": "Contraseña",
        "confirm_password": "Confirmar contraseña",
        "no_account": "¿No tienes cuenta?",
        "have_account": "¿Ya registrado?",
        "create_account": "Crear cuenta",
        "dashboard": "Panel",
        "my_restaurants": "Mis restaurantes",
        "new_restaurant": "Nuevo restaurante",
        "no_description": "Sin descripción",
        "manage": "Gestionar",
        "public_menu": "Menú público",
        "qr_code": "Código QR",
        "restaurant_form_new": "Nuevo restaurante",
        "restaurant_form_edit": "Editar restaurante",
        "no_restaurants": "Aún no hay restaurantes. Crea el primero.",
        "name": "Nombre",
        "description": "Descripción",
        "logo": "Logo",
        "save": "Guardar",
        "cancel": "Cancelar",
        "back": "Atrás",
        "categories": "Categorías",
        "drag_hint": "Arrastra para ordenar",
        "add_category": "+ Categoría",
        "order": "Orden",
        "edit": "Editar",
        "delete": "Eliminar",
        "add_dish": "+ Plato",
        "no_dishes": "Aún no hay platos.",
        "category_title": "Categoría para",
        "dish_title": "Plato en categoría",
        "price": "Precio",
        "currency": "Moneda",
        "available": "Disponible",
        "file_not_selected": "Archivo no seleccionado",
        "upload_hint": "Arrastra un archivo o haz clic",
        "public_link": "Enlace público",
        "language": "Idioma",
        "translations": "Traducciones",
        "translation_hint": "Proporciona el nombre y la descripción en otros idiomas (opcional)",
        "download": "Descargar",
        "no_users": "Aún no hay usuarios",
        "user_exists": "Ya existe un usuario con ese correo",
        "account_created": "Cuenta creada, inicia sesión",
        "bad_credentials": "Email o contraseña inválidos",
        "logged_out": "Has cerrado sesión",
        "restaurant_created": "Restaurante creado",
        "restaurant_updated": "Restaurante actualizado",
        "category_added": "Categoría añadida",
        "category_updated": "Categoría actualizada",
        "category_deleted": "Categoría eliminada",
        "dish_added": "Plato añadido",
        "dish_updated": "Plato actualizado",
        "dish_deleted": "Plato eliminado",
        "login_hero_pre": "Menú QR sin espera",
        "login_hero_title": "Crea un menú digital y comparte QR",
        "login_hero_sub": "Añade restaurantes, categorías y platos; genera QR en un solo panel.",
        "register_hero_pre": "Inicio rápido",
        "register_hero_title": "Lanza tu menú en 5 minutos",
        "register_hero_sub": "Logos, platos y QR en una sola interfaz.",
        "tables": "Mesas",
        "add_table": "+ Mesa",
        "table_number": "Número de mesa",
        "table_added": "Mesa agregada",
        "table_deleted": "Mesa eliminada",
        "table_exists": "Ese número ya existe",
        "no_tables": "Aún no hay mesas",
        "add_to_cart": "Añadir",
        "call_waiter": "Llamar al camarero",
        "table_label": "Mesa",
        "cart_items": "artículos",
    },
    "de": {
        "login": "Anmelden",
        "register": "Registrieren",
        "logout": "Abmelden",
        "admin": "Admin",
        "all_users": "Alle Benutzer",
        "all_restaurants": "Alle Restaurants",
        "owner": "Inhaber",
        "created": "Erstellt",
        "email": "Email",
        "password": "Passwort",
        "confirm_password": "Passwort bestätigen",
        "no_account": "Kein Konto?",
        "have_account": "Bereits registriert?",
        "create_account": "Konto erstellen",
        "dashboard": "Übersicht",
        "my_restaurants": "Meine Restaurants",
        "new_restaurant": "Neues Restaurant",
        "no_description": "Keine Beschreibung",
        "manage": "Verwalten",
        "public_menu": "Öffentliches Menü",
        "qr_code": "QR-Code",
        "restaurant_form_new": "Neues Restaurant",
        "restaurant_form_edit": "Restaurant bearbeiten",
        "no_restaurants": "Noch keine Restaurants. Erstelle das erste.",
        "name": "Name",
        "description": "Beschreibung",
        "logo": "Logo",
        "save": "Speichern",
        "cancel": "Abbrechen",
        "back": "Zurück",
        "categories": "Kategorien",
        "drag_hint": "Ziehen zum Sortieren",
        "add_category": "+ Kategorie",
        "order": "Reihenfolge",
        "edit": "Bearbeiten",
        "delete": "Löschen",
        "add_dish": "+ Gericht",
        "no_dishes": "Noch keine Gerichte.",
        "category_title": "Kategorie für",
        "dish_title": "Gericht in Kategorie",
        "price": "Preis",
        "currency": "Währung",
        "available": "Verfügbar",
        "file_not_selected": "Keine Datei ausgewählt",
        "upload_hint": "Datei ziehen oder klicken",
        "public_link": "Öffentlicher Link",
        "language": "Sprache",
        "translations": "Übersetzungen",
        "translation_hint": "Gib Namen und Beschreibung in anderen Sprachen an (optional)",
        "download": "Herunterladen",
        "no_users": "Noch keine Benutzer",
        "user_exists": "Benutzer mit dieser E-Mail existiert bereits",
        "account_created": "Konto erstellt, bitte anmelden",
        "bad_credentials": "Ungültige E-Mail oder Passwort",
        "logged_out": "Abgemeldet",
        "restaurant_created": "Restaurant erstellt",
        "restaurant_updated": "Restaurant aktualisiert",
        "category_added": "Kategorie hinzugefügt",
        "category_updated": "Kategorie aktualisiert",
        "category_deleted": "Kategorie gelöscht",
        "dish_added": "Gericht hinzugefügt",
        "dish_updated": "Gericht aktualisiert",
        "dish_deleted": "Gericht gelöscht",
        "login_hero_pre": "QR-Menü ohne Warten",
        "login_hero_title": "Erstelle ein digitales Menü und teile QR",
        "login_hero_sub": "Füge Restaurants, Kategorien und Gerichte hinzu; generiere QR an einem Ort.",
        "register_hero_pre": "Schneller Start",
        "register_hero_title": "Starte dein Menü in 5 Minuten",
        "register_hero_sub": "Logos, Gerichte und QR in einem Interface.",
        "tables": "Tische",
        "add_table": "+ Tisch",
        "table_number": "Tischnummer",
        "table_added": "Tisch hinzugefügt",
        "table_deleted": "Tisch gelöscht",
        "table_exists": "Diese Nummer existiert bereits",
        "no_tables": "Noch keine Tische",
        "add_to_cart": "Hinzufügen",
        "call_waiter": "Kellner rufen",
        "table_label": "Tisch",
        "cart_items": "Artikel",
    },
    "hi": {
        "login": "लॉगिन",
        "register": "रजिस्टर",
        "logout": "लॉगआउट",
        "admin": "एडमिन",
        "all_users": "सभी उपयोगकर्ता",
        "all_restaurants": "सभी रेस्टोरेंट",
        "owner": "मालिक",
        "created": "बनाया गया",
        "email": "ईमेल",
        "password": "पासवर्ड",
        "confirm_password": "पासवर्ड की पुष्टि",
        "no_account": "खाता नहीं है?",
        "have_account": "पहले से रजिस्टर हैं?",
        "create_account": "खाता बनाएँ",
        "dashboard": "डैशबोर्ड",
        "my_restaurants": "मेरे रेस्टोरेंट",
        "new_restaurant": "नया रेस्टोरेंट",
        "no_description": "विवरण नहीं",
        "manage": "प्रबंधन",
        "public_menu": "पब्लिक मेन्यू",
        "qr_code": "QR कोड",
        "restaurant_form_new": "नया रेस्टोरेंट",
        "restaurant_form_edit": "रेस्टोरेंट संपादित करें",
        "no_restaurants": "अभी कोई रेस्टोरेंट नहीं है। पहला बनाएं।",
        "name": "नाम",
        "description": "विवरण",
        "logo": "लोगो",
        "save": "सहेजें",
        "cancel": "रद्द करें",
        "back": "वापस",
        "categories": "श्रेणियाँ",
        "drag_hint": "क्रम बदलने के लिए खींचें",
        "add_category": "+ श्रेणी",
        "order": "क्रम",
        "edit": "संपादित करें",
        "delete": "हटाएँ",
        "add_dish": "+ डिश",
        "no_dishes": "अभी तक कोई डिश नहीं।",
        "category_title": "श्रेणी",
        "dish_title": "श्रेणी में डिश",
        "price": "कीमत",
        "currency": "मुद्रा",
        "available": "उपलब्ध",
        "file_not_selected": "फ़ाइल चयनित नहीं है",
        "upload_hint": "फ़ाइल खींचें या क्लिक करें",
        "public_link": "सार्वजनिक लिंक",
        "language": "भाषा",
        "translations": "अनुवाद",
        "translation_hint": "अन्य भाषाओं में नाम और विवरण भरें (वैकल्पिक)",
        "download": "डाउनलोड",
        "no_users": "अभी कोई उपयोगकर्ता नहीं है",
        "user_exists": "इस ईमेल से उपयोगकर्ता पहले से है",
        "account_created": "खाता बना, कृपया लॉगिन करें",
        "bad_credentials": "गलत ईमेल या पासवर्ड",
        "logged_out": "आप लॉगआउट हो गए",
        "restaurant_created": "रेस्टोरेंट बनाया गया",
        "restaurant_updated": "रेस्टोरेंट अपडेट हुआ",
        "category_added": "श्रेणी जोड़ी गई",
        "category_updated": "श्रेणी अपडेट हुई",
        "category_deleted": "श्रेणी हटाई गई",
        "dish_added": "डिश जोड़ी गई",
        "dish_updated": "डिश अपडेट हुई",
        "dish_deleted": "डिश हटाई गई",
        "login_hero_pre": "इंतज़ार के बिना QR मेन्यू",
        "login_hero_title": "डिजिटल मेन्यू बनाएं और QR साझा करें",
        "login_hero_sub": "रेस्टोरेंट, श्रेणियाँ, डिश जोड़ें और QR जनरेट करें — एक डैशबोर्ड में।",
        "register_hero_pre": "फास्ट स्टार्ट",
        "register_hero_title": "5 मिनट में मेन्यू लॉन्च करें",
        "register_hero_sub": "लोगो, डिश और QR एक ही इंटरफेस में।",
        "tables": "टेबल्स",
        "add_table": "+ टेबल",
        "table_number": "टेबल नंबर",
        "table_added": "टेबल जोड़ी गई",
        "table_deleted": "टेबल हटाई गई",
        "table_exists": "यह नंबर पहले से है",
        "no_tables": "अभी कोई टेबल नहीं है",
        "add_to_cart": "जोड़ें",
        "call_waiter": "वेटर बुलाएँ",
        "table_label": "टेबल",
        "cart_items": "आइटम",
    },
}
# Database configuration (MySQL by default; override via env)
DB_HOST = os.environ.get("DB_HOST", "127.0.0.1")
DB_USER = os.environ.get("DB_USER", "root")
DB_PASS = os.environ.get("DB_PASS", "StrongPass2025!")
DB_NAME = os.environ.get("DB_NAME", "menu_am")
DEFAULT_DB_URI = f"mysql+mysqlconnector://{DB_USER}:{DB_PASS}@{DB_HOST}/{DB_NAME}"

app = Flask(__name__)
app.config.update(
    SECRET_KEY=os.environ.get("SECRET_KEY", "dev-secret-change-me"),
    SQLALCHEMY_DATABASE_URI=os.environ.get("DATABASE_URL", DEFAULT_DB_URI),
    SQLALCHEMY_TRACK_MODIFICATIONS=False,
    UPLOAD_FOLDER=str(UPLOAD_ROOT),
    SQLALCHEMY_ENGINE_OPTIONS={
        "pool_pre_ping": True,
        "pool_recycle": 280,
    },
)

db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = "login"
# Prefer deep-translator; fallback to googletrans if installed.
translator = None
translator_type = None
if GoogleTranslator:
    translator = "deep"
    translator_type = "deep"
elif Translator:
    translator = Translator()
    translator_type = "googletrans"


class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    restaurants = db.relationship("Restaurant", backref="owner", lazy=True)

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)


class Restaurant(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    name_translations = db.Column(db.JSON, default=dict)
    description_translations = db.Column(db.JSON, default=dict)
    slug = db.Column(db.String(180), unique=True, nullable=False)
    logo_filename = db.Column(db.String(255), nullable=True)
    categories = db.relationship(
        "Category", backref="restaurant", lazy=True, cascade="all, delete-orphan", order_by="Category.sort_order"
    )
    tables = db.relationship("DiningTable", backref="restaurant", lazy=True, cascade="all, delete-orphan")

    def logo_url(self) -> str | None:
        if self.logo_filename:
            return url_for("uploaded_file", filename=self.logo_filename)
        return None

    def translated_name(self, lang: str) -> str:
        if lang == DEFAULT_LANG:
            return self.name
        translations = self.name_translations or {}
        return translations.get(lang) or self.name

    def translated_description(self, lang: str) -> str:
        if lang == DEFAULT_LANG:
            return self.description or ""
        translations = self.description_translations or {}
        return translations.get(lang) or (self.description or "")


class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    sort_order = db.Column(db.Integer, default=0)
    restaurant_id = db.Column(db.Integer, db.ForeignKey("restaurant.id"), nullable=False)
    name_translations = db.Column(db.JSON, default=dict)
    dishes = db.relationship(
        "Dish",
        backref="category",
        lazy=True,
        cascade="all, delete-orphan",
        order_by="Dish.name",
    )

    def translated_name(self, lang: str) -> str:
        if lang == DEFAULT_LANG:
            return self.name
        translations = self.name_translations or {}
        return translations.get(lang) or self.name


class Dish(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    available = db.Column(db.Boolean, default=True)
    image_filename = db.Column(db.String(255), nullable=True)
    currency = db.Column(db.String(8), nullable=False, default="AMD")
    name_translations = db.Column(db.JSON, default=dict)
    description_translations = db.Column(db.JSON, default=dict)
    category_id = db.Column(db.Integer, db.ForeignKey("category.id"), nullable=False)

    def image_url(self) -> str | None:
        if self.image_filename:
            return url_for("uploaded_file", filename=self.image_filename)
        return None

    def is_image(self) -> bool:
        return is_image_filename(self.image_filename)

    def translated_name(self, lang: str) -> str:
        if lang == DEFAULT_LANG:
            return self.name
        translations = self.name_translations or {}
        return translations.get(lang) or self.name

    def translated_description(self, lang: str) -> str:
        if lang == DEFAULT_LANG:
            return self.description or ""
        translations = self.description_translations or {}
        return translations.get(lang) or (self.description or "")

    def currency_symbol(self) -> str:
        return CURRENCY_SYMBOLS.get(self.currency or "AMD", "֏")


class DiningTable(db.Model):
    __tablename__ = "restaurant_tables"
    id = db.Column(db.Integer, primary_key=True)
    number = db.Column(db.Integer, nullable=False)
    restaurant_id = db.Column(db.Integer, db.ForeignKey("restaurant.id"), nullable=False)

    __table_args__ = (db.UniqueConstraint("restaurant_id", "number", name="uq_table_number_per_restaurant"),)


class CallRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    restaurant_id = db.Column(db.Integer, db.ForeignKey("restaurant.id"), nullable=False)
    table_number = db.Column(db.Integer, nullable=False)
    items = db.Column(db.JSON, default=list)
    status = db.Column(db.String(20), default="new")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    restaurant = db.relationship("Restaurant", backref="call_requests")

    def as_dict(self):
        lang = getattr(g, "lang", DEFAULT_LANG)
        return {
            "id": self.id,
            "restaurant": self.restaurant.translated_name(lang) if self.restaurant else None,
            "restaurant_id": self.restaurant_id,
            "table_number": self.table_number,
            "items": self.items or [],
            "status": self.status,
            "created_at": self.created_at.isoformat(),
        }


@login_manager.user_loader
def load_user(user_id: str):
    return db.session.get(User, int(user_id))


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = "".join([c for c in value if not unicodedata.combining(c)])
    value = value.lower()
    cleaned = []
    for ch in value:
        if ch.isalnum():
            cleaned.append(ch)
        elif ch in {" ", "-", "_"}:
            cleaned.append("-")
    slug = "".join(cleaned).strip("-")
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug or secrets.token_hex(4)


def unique_slug(base: str) -> str:
    base_slug = slugify(base)
    candidate = base_slug
    index = 1
    while Restaurant.query.filter_by(slug=candidate).first():
        candidate = f"{base_slug}-{index}"
        index += 1
    return candidate


def save_file(file_storage, folder: Path) -> str | None:
    if not file_storage or not getattr(file_storage, "filename", None):
        return None
    filename = secure_filename(file_storage.filename)
    if not filename:
        return None
    extension = Path(filename).suffix
    unique_name = f"{secrets.token_hex(8)}{extension}"
    destination = folder / unique_name
    file_storage.save(destination)
    return str(destination.relative_to(UPLOAD_ROOT))


def is_image_filename(name: str | None) -> bool:
    if not name:
        return False
    return Path(name).suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}

def is_admin_user(user: User | None) -> bool:
    if not user:
        return False
    if user.email.lower() in ADMIN_EMAILS:
        return True
    return False


def translate_text(text: str, target_lang: str) -> str | None:
    if not text or not translator_type:
        return None
    try:
        if translator_type == "deep" and GoogleTranslator:
            return GoogleTranslator(source="auto", target=target_lang).translate(text)
        if translator_type == "googletrans" and Translator:
            result = translator.translate(text, dest=target_lang)
            return result.text
    except Exception:
        return None
    return None


def translate_ui(key: str, lang: str) -> str:
    table = UI_TRANSLATIONS.get(lang) or UI_TRANSLATIONS.get(DEFAULT_LANG) or UI_TRANSLATIONS.get("en", {})
    fallback_table = UI_TRANSLATIONS.get(DEFAULT_LANG) or {}
    return table.get(key) or fallback_table.get(key) or key


def translate_menu(key: str, lang: str) -> str:
    table = TRANSLATIONS.get(lang) or TRANSLATIONS.get(DEFAULT_LANG) or TRANSLATIONS.get("en", {})
    fallback_table = TRANSLATIONS.get(DEFAULT_LANG) or {}
    return table.get(key) or fallback_table.get(key) or key


def admin_required(func):
    from functools import wraps

    @wraps(func)
    def wrapper(*args, **kwargs):
        if not current_user.is_authenticated or not is_admin_user(current_user):
            abort(403)
        return func(*args, **kwargs)

    return wrapper


def flash_t(key: str, category: str = "info"):
    lang = getattr(g, "lang", DEFAULT_LANG)
    flash(translate_ui(key, lang), category)


def populate_translations_for_category(category: Category):
    translations = category.name_translations or {}
    for lang in LANGUAGES:
        if lang == DEFAULT_LANG:
            continue
        if translations.get(lang):
            continue
        translated = translate_text(category.name, lang)
            
        if translated:
            translations[lang] = translated
    category.name_translations = translations


def populate_translations_for_dish(dish: Dish):
    name_trans = dish.name_translations or {}
    desc_trans = dish.description_translations or {}
    for lang in LANGUAGES:
        if lang == DEFAULT_LANG:
            continue
        if not name_trans.get(lang):
            translated = translate_text(dish.name, lang)
            if translated:
                name_trans[lang] = translated
        if dish.description and not desc_trans.get(lang):
            translated_desc = translate_text(dish.description, lang)
            if translated_desc:
                desc_trans[lang] = translated_desc
    dish.name_translations = name_trans
    dish.description_translations = desc_trans


def populate_translations_for_restaurant(restaurant: Restaurant):
    name_trans = restaurant.name_translations or {}
    desc_trans = restaurant.description_translations or {}
    for lang in LANGUAGES:
        if lang == DEFAULT_LANG:
            continue
        if restaurant.name and not name_trans.get(lang):
            translated = translate_text(restaurant.name, lang)
            if translated:
                name_trans[lang] = translated
        if restaurant.description and not desc_trans.get(lang):
            translated_desc = translate_text(restaurant.description, lang)
            if translated_desc:
                desc_trans[lang] = translated_desc
    restaurant.name_translations = name_trans
    restaurant.description_translations = desc_trans


def extract_translation_submission(prefix: str) -> dict[str, str]:
    """Return raw translation values keyed by lang."""
    values: dict[str, str] = {}
    for code in LANGUAGES:
        if code == DEFAULT_LANG:
            continue
        field_name = f"{prefix}_translation_{code}"
        if field_name in request.form:
            values[code] = request.form.get(field_name, "").strip()
    return values


def build_translation_context(restaurant: Restaurant | None) -> dict[str, dict[str, str]]:
    """Prepare translation values for templates."""
    context: dict[str, dict[str, str]] = {}
    existing_names = (restaurant.name_translations if restaurant else {}) or {}
    existing_desc = (restaurant.description_translations if restaurant else {}) or {}
    for code in LANGUAGES:
        if code == DEFAULT_LANG:
            continue
        if request.method == "POST":
            name_val = request.form.get(f"name_translation_{code}", "")
            desc_val = request.form.get(f"description_translation_{code}", "")
        else:
            name_val = existing_names.get(code, "")
            desc_val = existing_desc.get(code, "")
        context[code] = {"name": name_val, "description": desc_val}
    return context


def resolve_lang():
    lang = session.get("lang")
    requested = request.args.get("lang")
    if requested in LANGUAGES:
        lang = requested
        session["lang"] = lang
    if not lang:
        best = request.accept_languages.best_match(list(LANGUAGES.keys()))
        if best:
            lang = best
    return lang or DEFAULT_LANG


@app.before_request
def set_lang():
    g.lang = resolve_lang()
    g.is_admin = is_admin_user(current_user) if current_user.is_authenticated else False


@app.context_processor
def inject_lang():
    lang = getattr(g, "lang", DEFAULT_LANG)
    return {
        "lang": lang,
        "languages": LANGUAGES,
        "default_lang": DEFAULT_LANG,
        "t": lambda key: translate_ui(key, lang),
        "t_menu": lambda key: translate_menu(key, lang),
        "is_admin": is_admin_user(current_user) if current_user.is_authenticated else False,
    }


class RegistrationForm(FlaskForm):
    email = StringField("Email", validators=[DataRequired(), Email(), Length(max=120)])
    password = PasswordField("Пароль", validators=[DataRequired(), Length(min=6)])
    confirm = PasswordField("Подтверждение", validators=[DataRequired(), EqualTo("password")])


class LoginForm(FlaskForm):
    email = StringField("Email", validators=[DataRequired(), Email()])
    password = PasswordField("Пароль", validators=[DataRequired()])


class RestaurantForm(FlaskForm):
    name = StringField("Название", validators=[DataRequired(), Length(max=150)])
    description = TextAreaField("Описание", validators=[Length(max=1000)])
    logo = FileField("Логотип (PNG/JPG)")


class CategoryForm(FlaskForm):
    name = StringField("Название", validators=[DataRequired(), Length(max=120)])
    sort_order = IntegerField("Порядок", default=0, validators=[NumberRange(min=0, max=999)])


class DishForm(FlaskForm):
    name = StringField("Название", validators=[DataRequired(), Length(max=150)])
    description = TextAreaField("Описание", validators=[Length(max=1000)])
    price = DecimalField("Цена", validators=[DataRequired(), NumberRange(min=0)], places=2)
    available = BooleanField("В наличии", default=True)
    currency = SelectField(
        "Валюта",
        choices=[("AMD", "AMD ֏"), ("USD", "USD $"), ("EUR", "EUR €"), ("RUB", "RUB ₽"), ("GBP", "GBP £")],
        default="AMD",
    )
    image = FileField("Картинка (опционально)")


class TableForm(FlaskForm):
    number = IntegerField("Номер стола", validators=[DataRequired(), NumberRange(min=1, max=9999)])


class CallWaiterForm(FlaskForm):
    pass


@app.route("/uploads/<path:filename>")
def uploaded_file(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)


@app.route("/")
def home():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard"))
    return redirect(url_for("login"))


@app.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard"))
    form = RegistrationForm()
    if form.validate_on_submit():
        existing = User.query.filter_by(email=form.email.data.lower()).first()
        if existing:
            flash_t("user_exists", "warning")
        else:
            user = User(email=form.email.data.lower())
            user.set_password(form.password.data)
            db.session.add(user)
            db.session.commit()
            flash_t("account_created", "success")
            return redirect(url_for("login"))
    return render_template("auth/register.html", form=form)


@app.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard"))
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data.lower()).first()
        if not user or not user.check_password(form.password.data):
            flash_t("bad_credentials", "danger")
        else:
            login_user(user)
            return redirect(url_for("dashboard"))
    return render_template("auth/login.html", form=form)


@app.route("/logout")
@login_required
def logout():
    logout_user()
    flash_t("logged_out", "info")
    return redirect(url_for("login"))


@app.route("/dashboard")
@login_required
def dashboard():
    restaurants = Restaurant.query.filter_by(user_id=current_user.id).all()
    requests = (
        CallRequest.query.join(Restaurant)
        .filter(Restaurant.user_id == current_user.id)
        .order_by(CallRequest.created_at.desc())
        .limit(50)
        .all()
    )
    requests_data = [r.as_dict() for r in requests]
    return render_template("dashboard.html", restaurants=restaurants, requests=requests_data)


@app.route("/api/my/call_requests")
@login_required
def api_my_call_requests():
    requests = (
        CallRequest.query.join(Restaurant)
        .filter(Restaurant.user_id == current_user.id)
        .order_by(CallRequest.created_at.desc())
        .limit(100)
        .all()
    )
    return {"requests": [r.as_dict() for r in requests]}


@app.route("/api/call_requests/<int:req_id>/seen", methods=["POST"])
@login_required
def api_mark_request_seen(req_id: int):
    req = db.session.get(CallRequest, req_id)
    if not req or req.restaurant.owner != current_user:
        abort(404)
    req.status = "seen"
    db.session.commit()
    return {"status": "ok"}


@app.route("/admin/users")
@login_required
@admin_required
def admin_users():
    users = User.query.order_by(User.email).all()
    # Preload restaurant counts per user
    counts = {u.id: 0 for u in users}
    for r in Restaurant.query.with_entities(Restaurant.user_id).all():
        counts[r.user_id] = counts.get(r.user_id, 0) + 1
    return render_template("admin_users.html", users=users, counts=counts)


@app.route("/admin/restaurants")
@login_required
@admin_required
def admin_restaurants():
    restaurants = Restaurant.query.order_by(Restaurant.name).all()
    return render_template("admin_restaurants.html", restaurants=restaurants)


@app.route("/restaurants/new", methods=["GET", "POST"])
@login_required
def create_restaurant():
    form = RestaurantForm()
    translation_values = build_translation_context(None)
    if form.validate_on_submit():
        logo_filename = save_file(form.logo.data, LOGO_FOLDER)
        name_translations_raw = extract_translation_submission("name")
        desc_translations_raw = extract_translation_submission("description")
        restaurant = Restaurant(
            name=form.name.data,
            description=form.description.data,
            slug=unique_slug(form.name.data),
            logo_filename=logo_filename,
            owner=current_user,
            name_translations={lang: text for lang, text in name_translations_raw.items() if text},
            description_translations={lang: text for lang, text in desc_translations_raw.items() if text},
        )
        populate_translations_for_restaurant(restaurant)
        db.session.add(restaurant)
        db.session.commit()
        flash_t("restaurant_created", "success")
        return redirect(url_for("manage_restaurant", restaurant_id=restaurant.id))
    return render_template("restaurant_form.html", form=form, restaurant=None, translation_values=translation_values)


def require_restaurant_owned(restaurant_id: int) -> Restaurant:
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or restaurant.owner != current_user:
        abort(404)
    return restaurant


@app.route("/restaurants/<int:restaurant_id>/edit", methods=["GET", "POST"])
@login_required
def edit_restaurant(restaurant_id: int):
    restaurant = require_restaurant_owned(restaurant_id)
    form = RestaurantForm(obj=restaurant)
    translation_values = build_translation_context(restaurant)
    if form.validate_on_submit():
        restaurant.name = form.name.data
        restaurant.description = form.description.data
        name_translations_raw = extract_translation_submission("name")
        desc_translations_raw = extract_translation_submission("description")
        name_translations = restaurant.name_translations or {}
        desc_translations = restaurant.description_translations or {}
        for lang, value in name_translations_raw.items():
            if value:
                name_translations[lang] = value
            else:
                name_translations.pop(lang, None)
        for lang, value in desc_translations_raw.items():
            if value:
                desc_translations[lang] = value
            else:
                desc_translations.pop(lang, None)
        restaurant.name_translations = name_translations
        restaurant.description_translations = desc_translations
        populate_translations_for_restaurant(restaurant)
        if form.logo.data:
            restaurant.logo_filename = save_file(form.logo.data, LOGO_FOLDER)
        db.session.commit()
        flash_t("restaurant_updated", "success")
        return redirect(url_for("manage_restaurant", restaurant_id=restaurant.id))
    return render_template(
        "restaurant_form.html", form=form, restaurant=restaurant, translation_values=translation_values
    )


@app.route("/restaurants/<int:restaurant_id>/manage")
@login_required
def manage_restaurant(restaurant_id: int):
    restaurant = require_restaurant_owned(restaurant_id)
    categories = (
        Category.query.filter_by(restaurant_id=restaurant.id).order_by(Category.sort_order, Category.name).all()
    )
    tables = DiningTable.query.filter_by(restaurant_id=restaurant.id).order_by(DiningTable.number).all()
    return render_template("restaurant_manage.html", restaurant=restaurant, categories=categories, tables=tables)


@app.route("/restaurants/<int:restaurant_id>/categories/new", methods=["GET", "POST"])
@login_required
def create_category(restaurant_id: int):
    restaurant = require_restaurant_owned(restaurant_id)
    form = CategoryForm()
    if form.validate_on_submit():
        category = Category(name=form.name.data, sort_order=form.sort_order.data or 0, restaurant=restaurant)
        populate_translations_for_category(category)
        db.session.add(category)
        db.session.commit()
        flash_t("category_added", "success")
        return redirect(url_for("manage_restaurant", restaurant_id=restaurant.id))
    return render_template("category_form.html", form=form, restaurant=restaurant)


@app.route("/categories/<int:category_id>/edit", methods=["GET", "POST"])
@login_required
def edit_category(category_id: int):
    category = db.session.get(Category, category_id)
    if not category or category.restaurant.owner != current_user:
        abort(404)
    form = CategoryForm(obj=category)
    if form.validate_on_submit():
        category.name = form.name.data
        category.sort_order = form.sort_order.data or 0
        populate_translations_for_category(category)
        db.session.commit()
        flash_t("category_updated", "success")
        return redirect(url_for("manage_restaurant", restaurant_id=category.restaurant.id))
    return render_template("category_form.html", form=form, restaurant=category.restaurant)


@app.route("/categories/<int:category_id>/delete", methods=["POST"])
@login_required
def delete_category(category_id: int):
    category = db.session.get(Category, category_id)
    if not category or category.restaurant.owner != current_user:
        abort(404)
    restaurant_id = category.restaurant.id
    db.session.delete(category)
    db.session.commit()
    flash_t("category_deleted", "info")
    return redirect(url_for("manage_restaurant", restaurant_id=restaurant_id))


@app.route("/categories/<int:category_id>/dishes/new", methods=["GET", "POST"])
@login_required
def create_dish(category_id: int):
    category = db.session.get(Category, category_id)
    if not category or category.restaurant.owner != current_user:
        abort(404)
    form = DishForm()
    if form.validate_on_submit():
        image_filename = save_file(form.image.data, DISH_FOLDER)
        dish = Dish(
            name=form.name.data,
            description=form.description.data,
            price=form.price.data,
            available=form.available.data,
            currency=form.currency.data,
            image_filename=image_filename,
            category=category,
        )
        populate_translations_for_dish(dish)
        db.session.add(dish)
        db.session.commit()
        flash_t("dish_added", "success")
        return redirect(url_for("manage_restaurant", restaurant_id=category.restaurant.id))
    return render_template("dish_form.html", form=form, category=category, restaurant=category.restaurant)


@app.route("/dishes/<int:dish_id>/edit", methods=["GET", "POST"])
@login_required
def edit_dish(dish_id: int):
    dish = db.session.get(Dish, dish_id)
    if not dish or dish.category.restaurant.owner != current_user:
        abort(404)
    form = DishForm(obj=dish)
    if form.validate_on_submit():
        dish.name = form.name.data
        dish.description = form.description.data
        dish.price = form.price.data
        dish.available = form.available.data
        dish.currency = form.currency.data
        if form.image.data:
            dish.image_filename = save_file(form.image.data, DISH_FOLDER)
        db.session.commit()
        flash_t("dish_updated", "success")
        return redirect(url_for("manage_restaurant", restaurant_id=dish.category.restaurant.id))
    return render_template("dish_form.html", form=form, category=dish.category, restaurant=dish.category.restaurant)


@app.route("/dishes/<int:dish_id>/delete", methods=["POST"])
@login_required
def delete_dish(dish_id: int):
    dish = db.session.get(Dish, dish_id)
    if not dish or dish.category.restaurant.owner != current_user:
        abort(404)
    restaurant_id = dish.category.restaurant.id
    db.session.delete(dish)
    db.session.commit()
    flash_t("dish_deleted", "info")
    return redirect(url_for("manage_restaurant", restaurant_id=restaurant_id))


@app.route("/restaurants/<int:restaurant_id>/categories/reorder", methods=["POST"])
@login_required
def reorder_categories(restaurant_id: int):
    restaurant = require_restaurant_owned(restaurant_id)
    data = request.get_json(force=True, silent=True) or {}
    order = data.get("order", [])
    if not isinstance(order, list):
        abort(400)
    # Build map for quick lookup and apply new sort_order
    categories = Category.query.filter_by(restaurant_id=restaurant.id).all()
    cat_map = {str(cat.id): cat for cat in categories}
    for idx, cat_id in enumerate(order):
        cat = cat_map.get(str(cat_id))
        if cat:
            cat.sort_order = idx
    db.session.commit()
    return {"status": "ok"}


@app.route("/restaurants/<int:restaurant_id>/qr")
@login_required
def restaurant_qr(restaurant_id: int):
    restaurant = require_restaurant_owned(restaurant_id)
    menu_url = url_for("public_menu", slug=restaurant.slug, _external=True)
    qr_path = QR_FOLDER / f"restaurant_{restaurant.id}.png"
    img = qrcode.make(menu_url)
    img.save(qr_path)
    qr_filename = str(qr_path.relative_to(UPLOAD_ROOT))
    return render_template("qr_page.html", restaurant=restaurant, menu_url=menu_url, qr_filename=qr_filename)


@app.route("/restaurants/<int:restaurant_id>/tables/new", methods=["GET", "POST"])
@login_required
def create_table(restaurant_id: int):
    restaurant = require_restaurant_owned(restaurant_id)
    form = TableForm()
    if form.validate_on_submit():
        existing = DiningTable.query.filter_by(restaurant_id=restaurant.id, number=form.number.data).first()
        if existing:
            flash_t("table_exists", "warning")
        else:
            table = DiningTable(number=form.number.data, restaurant=restaurant)
            db.session.add(table)
            db.session.commit()
            flash_t("table_added", "success")
            return redirect(url_for("manage_restaurant", restaurant_id=restaurant.id))
    return render_template("table_form.html", form=form, restaurant=restaurant)


@app.route("/tables/<int:table_id>/delete", methods=["POST"])
@login_required
def delete_table(table_id: int):
    table = db.session.get(DiningTable, table_id)
    if not table or table.restaurant.owner != current_user:
        abort(404)
    restaurant_id = table.restaurant.id
    db.session.delete(table)
    db.session.commit()
    flash_t("table_deleted", "info")
    return redirect(url_for("manage_restaurant", restaurant_id=restaurant_id))


@app.route("/tables/<int:table_id>/qr")
@login_required
def table_qr(table_id: int):
    table = db.session.get(DiningTable, table_id)
    if not table or table.restaurant.owner != current_user:
        abort(404)
    menu_url = url_for("public_menu", slug=table.restaurant.slug, table=table.number, _external=True)
    qr_path = QR_FOLDER / f"table_{table.id}.png"
    img = qrcode.make(menu_url)
    img.save(qr_path)
    qr_filename = str(qr_path.relative_to(UPLOAD_ROOT))
    return render_template("qr_page.html", restaurant=table.restaurant, menu_url=menu_url, qr_filename=qr_filename)


@app.route("/menu/<slug>/")
def public_menu(slug: str):
    restaurant = Restaurant.query.filter_by(slug=slug).first_or_404()
    categories = (
        Category.query.filter_by(restaurant_id=restaurant.id).order_by(Category.sort_order, Category.name).all()
    )
    return render_template(
        "public_menu.html",
        restaurant=restaurant,
        categories=categories,
        table_number=request.args.get("table"),
    )


@app.route("/api/call_waiter", methods=["POST"])
def api_call_waiter():
    data = request.get_json(force=True, silent=True) or {}
    slug = data.get("slug")
    table = data.get("table")
    items = data.get("items", [])
    restaurant = Restaurant.query.filter_by(slug=slug).first()
    if not restaurant or not table:
        abort(400)
    try:
        table_number = int(table)
    except Exception:
        abort(400)
    req = CallRequest(restaurant_id=restaurant.id, table_number=table_number, items=items)
    db.session.add(req)
    db.session.commit()
    return {"status": "ok"}


@app.route("/set-lang")
def set_lang():
    lang = request.args.get("lang")
    if lang in LANGUAGES:
        session["lang"] = lang
    ref = request.referrer or url_for("home")
    return redirect(ref)


with app.app_context():
    db.create_all()


def build_ssl_context() -> tuple[str, str] | None:
    """Return SSL context tuple if cert/key env vars are provided and valid."""

    def resolve_path(raw_value: str | None) -> Path | None:
        if not raw_value:
            return None
        candidate = Path(raw_value).expanduser()
        if candidate.is_file():
            return candidate
        # Support project-relative paths.
        if not candidate.is_absolute():
            relative_candidate = (BASE_DIR / candidate).resolve()
            if relative_candidate.is_file():
                return relative_candidate
        # As a last resort, try file name inside BASE_DIR (handles /wrong/path/cert.pem)
        basename_candidate = (BASE_DIR / candidate.name).resolve()
        if basename_candidate.is_file():
            return basename_candidate
        return None

    cert_file = resolve_path(os.environ.get("SSL_CERT_PATH"))
    key_file = resolve_path(os.environ.get("SSL_KEY_PATH"))
    if not (cert_file and key_file):
        missing_parts = []
        if not cert_file:
            missing_parts.append("certificate file")
        if not key_file:
            missing_parts.append("key file")
        if missing_parts:
            app.logger.warning(
                "SSL disabled: %s not configured or file not found", " and ".join(missing_parts)
            )
        return None
    return (str(cert_file), str(key_file))


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=81, debug=True, ssl_context=build_ssl_context())
