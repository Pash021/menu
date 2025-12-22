from __future__ import annotations

import json
import io
import mimetypes
import os
import secrets
import unicodedata
from pathlib import Path
from datetime import datetime

from dotenv import load_dotenv
from markupsafe import Markup

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
from sqlalchemy import text, inspect
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload, selectinload
from flask_wtf import FlaskForm
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.exceptions import HTTPException
from werkzeug.utils import secure_filename
from wtforms import BooleanField, DecimalField, FileField, IntegerField, PasswordField, SelectField, StringField, TextAreaField
from wtforms.validators import DataRequired, Email, EqualTo, Length, NumberRange
import qrcode
from googletrans import Translator
from PIL import Image, ImageOps, UnidentifiedImageError
from datetime import datetime
import copy

# Paths
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_ROOT = BASE_DIR / "uploads"
LOGO_FOLDER = UPLOAD_ROOT / "logos"
DISH_FOLDER = UPLOAD_ROOT / "dishes"
QR_FOLDER = UPLOAD_ROOT / "qr"
CATEGORY_FOLDER = UPLOAD_ROOT / "categories"
FONT_FOLDER = UPLOAD_ROOT / "fonts"
LOADER_FOLDER = UPLOAD_ROOT / "loaders"
load_dotenv(BASE_DIR / ".env")
for folder in (UPLOAD_ROOT, LOGO_FOLDER, DISH_FOLDER, QR_FOLDER, CATEGORY_FOLDER, FONT_FOLDER, LOADER_FOLDER):
    folder.mkdir(parents=True, exist_ok=True)
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("image/avif", ".avif")
mimetypes.add_type("image/gif", ".gif")
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("font/woff", ".woff")
mimetypes.add_type("font/ttf", ".ttf")
mimetypes.add_type("font/otf", ".otf")
mimetypes.add_type("application/pdf", ".pdf")

# Upload limits (affects request max size for multipart/form-data)
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", str(8 * 1024 * 1024)))
MAX_CATEGORY_ICON_BYTES = int(os.environ.get("MAX_CATEGORY_ICON_BYTES", str(5 * 1024 * 1024)))
MAX_LOGO_BYTES = int(os.environ.get("MAX_LOGO_BYTES", str(min(MAX_UPLOAD_BYTES, 5 * 1024 * 1024))))
CATEGORY_ICON_MAX_PX = int(os.environ.get("CATEGORY_ICON_MAX_PX", "240"))
DISH_IMAGE_MAX_PX = int(os.environ.get("DISH_IMAGE_MAX_PX", "960"))
DISH_IMAGE_QUALITY = int(os.environ.get("DISH_IMAGE_QUALITY", "82"))
MAX_FONT_BYTES = int(os.environ.get("MAX_FONT_BYTES", str(5 * 1024 * 1024)))
MAX_LOADER_BYTES = int(os.environ.get("MAX_LOADER_BYTES", str(5 * 1024 * 1024)))
LOADER_MAX_PX = int(os.environ.get("LOADER_MAX_PX", "320"))
ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_LOGO_EXTS = {".svg", ".png", ".jpg", ".jpeg", ".webp"}
ALLOWED_LOGO_MIMES = {"image/svg+xml", *ALLOWED_IMAGE_MIMES}
ALLOWED_CATEGORY_ICON_EXTS = {".svg", ".avif", ".png", ".jpg", ".jpeg", ".webp"}
ALLOWED_CATEGORY_ICON_MIMES = {
    "image/svg+xml",
    "image/avif",
    "image/png",
    "image/jpeg",
    "image/webp",
}
ALLOWED_LOADER_EXTS = {".svg", ".avif", ".gif", ".png", ".jpg", ".jpeg", ".webp"}
ALLOWED_LOADER_MIMES = {
    "image/svg+xml",
    "image/avif",
    "image/gif",
    "image/png",
    "image/jpeg",
    "image/webp",
}
ALLOWED_LOADER_STYLES = {"spinner", "dots", "ring"}
ALLOWED_FONT_EXTS = {".woff2", ".woff", ".ttf", ".otf"}
ALLOWED_FONT_MIMES = {
    "font/woff2",
    "font/woff",
    "font/ttf",
    "font/otf",
    "application/font-woff2",
    "application/font-woff",
    "application/x-font-ttf",
    "application/x-font-otf",
    "application/octet-stream",
}

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

CATEGORY_ICON_CHOICES = [
    ("", "Без иконки"),
    ("bakery_dining", "Выпечка"),
    ("local_pizza", "Пицца"),
    ("lunch_dining", "Бургер/сэндвич"),
    ("ramen_dining", "Лапша/суп"),
    ("kebab_dining", "Гриль/шашлык"),
    ("icecream", "Десерт/мороженое"),
    ("cake", "Торт"),
    ("coffee", "Кофе/чай"),
    ("emoji_food_beverage", "Напитки"),
    ("set_meal", "Основные блюда"),
    ("egg_alt", "Завтрак"),
    ("fish", "Рыба"),
    ("spa", "Вегетарианское/здоровое"),
]

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

REQUEST_STATUS = ("new", "seen", "delivered", "canceled")
REQUEST_STATUS_SET = set(REQUEST_STATUS)

UI_TRANSLATIONS = {
    "ru": {
        "login": "Войти",
        "register": "Регистрация",
        "logout": "Выйти",
        "admin": "Админка",
        "all_users": "Все пользователи",
        "all_restaurants": "Все рестораны",
        "owner": "Владелец",
        "manager": "Менеджер",
        "created": "Создано",
        "email": "Email",
        "username": "Логин",
        "username_or_email": "Логин или email",
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
        "restaurant_deleted": "Ресторан удален",
        "restaurant_delete_failed": "Не удалось удалить ресторан",
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
        "table_occupied": "Занято",
        "table_free": "Свободно",
        "mark_occupied": "Отметить занятым",
        "mark_free": "Освободить",
        "table_marked_occupied": "Стол отмечен занятым",
        "table_marked_free": "Стол отмечен свободным",
        "no_tables": "Столы не добавлены",
        "collaborators": "Менеджеры",
        "collaborator_added": "Менеджер добавлен",
        "collaborator_exists": "Менеджер уже назначен",
        "collaborator_missing_fields": "Укажите логин и пароль",
        "password_too_short": "Минимум 8 символов",
        "password_requirements": "Пароль: минимум 8 символов, буквы и цифры, два символа не подряд",
        "password_no_restaurant": "Пароль не должен содержать название ресторана",
        "collaborator_removed": "Менеджер удален",
        "password_updated": "Пароль обновлен",
        "blocked": "Заблокирован",
        "block": "Заблокировать",
        "unblock": "Разблокировать",
        "user_blocked_login": "Аккаунт заблокирован, обратитесь к администратору",
        "user_blocked": "Пользователь заблокирован",
        "user_unblocked": "Пользователь разблокирован",
        "cannot_block_admin": "Нельзя блокировать админа или себя",
        "no_categories": "Категории еще не добавлены",
        "add_to_cart": "Добавить",
        "call_waiter": "Позвать официанта",
        "orders": "Заказы",
        "table_label": "Стол",
        "cart_items": "товаров",
        "clear_cart": "Очистить",
        "cart_empty": "Пока ничего не выбрано",
        "cart_hide": "Скрыть",
        "cart_show": "Показать",
        "spicy": "Острое",
        "vegan": "Веганское",
        "cart_remove": "Удалить",
        "cart_increase": "Больше",
        "cart_decrease": "Меньше",
        "new_request_alert": "Новый вызов",
        "confirm_call": "Подтвердите меню",
        "confirm_call_desc": "Отправить заказ официанту?",
        "history": "История",
        "mark_delivered": "Доставлено",
        "mark_canceled": "Отменено",
        "status_new": "Новое",
        "status_seen": "Просмотрено",
        "status_delivered": "Доставлено",
        "status_canceled": "Отменено",
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
        "manager": "Manager",
        "created": "Created",
        "email": "Email",
        "username": "Username",
        "username_or_email": "Username or email",
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
        "restaurant_deleted": "Restaurant deleted",
        "restaurant_delete_failed": "Failed to delete restaurant",
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
        "table_occupied": "Occupied",
        "table_free": "Free",
        "mark_occupied": "Mark occupied",
        "mark_free": "Mark free",
        "table_marked_occupied": "Table marked occupied",
        "table_marked_free": "Table marked free",
        "no_tables": "No tables yet",
        "collaborators": "Managers",
        "collaborator_added": "Manager added",
        "collaborator_exists": "Manager already assigned",
        "collaborator_missing_fields": "Username and password are required",
        "password_too_short": "Minimum 8 characters",
        "password_requirements": "Password: 8+ chars, letters, digits, two symbols not adjacent",
        "password_no_restaurant": "Password must not include the restaurant name",
        "collaborator_removed": "Manager removed",
        "password_updated": "Password updated",
        "blocked": "Blocked",
        "block": "Block",
        "unblock": "Unblock",
        "user_blocked_login": "Your account is blocked. Contact an administrator.",
        "user_blocked": "User blocked",
        "user_unblocked": "User unblocked",
        "cannot_block_admin": "Cannot block an admin account",
        "registered_orders": "Registered orders",
        "no_categories": "No categories yet",
        "add_to_cart": "Add",
        "call_waiter": "Call waiter",
        "orders": "Orders",
        "table_label": "Table",
        "cart_items": "items",
        "clear_cart": "Clear",
        "cart_empty": "No items yet",
        "cart_hide": "Hide",
        "cart_show": "Show",
        "spicy": "Spicy",
        "vegan": "Vegan",
        "cart_remove": "Remove",
        "cart_increase": "More",
        "cart_decrease": "Less",
        "new_request_alert": "New request",
        "confirm_call": "Confirm menu",
        "confirm_call_desc": "Send the order to the waiter?",
        "history": "History",
        "mark_delivered": "Mark delivered",
        "mark_canceled": "Mark canceled",
        "status_new": "New",
        "status_seen": "Seen",
        "status_delivered": "Delivered",
        "status_canceled": "Canceled",
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
        "manager": "Մենեջեր",
        "created": "Ստեղծված է",
        "email": "Էլ.փոստ",
        "username": "Մուտքանուն",
        "username_or_email": "Մուտքանուն կամ email",
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
        "restaurant_deleted": "Ռեստորանը ջնջվեց",
        "restaurant_delete_failed": "Չհաջողվեց ջնջել ռեստորանը",
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
        "table_occupied": "Զբաղված",
        "table_free": "Ազատ",
        "mark_occupied": "Նշել զբաղված",
        "mark_free": "Նշել ազատ",
        "table_marked_occupied": "Սեղանը նշվեց զբաղված",
        "table_marked_free": "Սեղանը նշվեց ազատ",
        "no_tables": "Սեղաններ չկան",
        "collaborators": "Մենեջերներ",
        "collaborator_added": "Մենեջերը ավելացվեց",
        "collaborator_exists": "Այս մենեջերը արդեն ավելացված է",
        "collaborator_missing_fields": "Պետք է լրացնել մուտքանունը և գաղտնաբառը",
        "password_too_short": "Առնվազն 8 նշան",
        "password_requirements": "Գաղտնաբառը պետք է լինի 8+ նշան, պարունակի տառեր, թվեր և 2 նշան՝ ոչ միաժամանակ",
        "password_no_restaurant": "Գաղտնաբառը չի կարող պարունակի ռեստորանի անունը",
        "collaborator_removed": "Մենեջերը հեռացվեց",
        "password_updated": "Գաղտնաբառը թարմացվեց",
        "blocked": "Արգելափակված",
        "block": "Արգելափակել",
        "unblock": "Ապաբլոկավորել",
        "user_blocked_login": "Հաշիվը արգելափակված է, դիմեք ադմինիստրատորին",
        "user_blocked": "Օգտատերը արգելափակվեց",
        "user_unblocked": "Մուտքն ակտիվացվեց",
        "cannot_block_admin": "Չի կարելի արգելափակել ադմինին կամ ինքներդ ձեզ",
        "registered_orders": "Գրանցված պատվերներ",
        "no_categories": "Կատեգորիաներ դեռ չկան",
        "add_to_cart": "Ավելացնել",
        "call_waiter": "Գրանցել պատվեր",
        "orders": "Պատվերներ",
        "table_label": "Սեղան",
        "cart_items": "պատվեր",
        "clear_cart": "Մաքրել",
        "cart_empty": "Դեռ բան չի ընտրվել",
        "cart_hide": "Թաքցնել",
        "cart_show": "Ցույց տալ",
        "spicy": "Կծու",
        "vegan": "Վեգան",
        "cart_remove": "Հեռացնել",
        "cart_increase": "Ավելացնել",
        "cart_decrease": "Նվազեցնել",
        "new_request_alert": "Նոր կանչ",
        "confirm_call": "Հաստատե՞լ մենյուն",
        "confirm_call_desc": "Ուղարկե՞լ պատվերը մատուցողին:",
        "history": "Պատմություն",
        "mark_delivered": "Մատուցված է",
        "mark_canceled": "Չեղարկված",
        "status_new": "Նոր",
        "status_seen": "Դիտված",
        "status_delivered": "Մատուցված",
        "status_canceled": "Չեղարկված",
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
        "manager": "مدير",
        "created": "تم الإنشاء",
        "email": "البريد الإلكتروني",
        "username": "اسم المستخدم",
        "username_or_email": "اسم المستخدم أو البريد",
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
        "restaurant_deleted": "تم حذف المطعم",
        "restaurant_delete_failed": "تعذر حذف المطعم",
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
        "table_occupied": "مشغولة",
        "table_free": "متاحة",
        "mark_occupied": "وضع كـ مشغولة",
        "mark_free": "وضع كـ متاحة",
        "table_marked_occupied": "تم وضع الطاولة كـ مشغولة",
        "table_marked_free": "تم وضع الطاولة كـ متاحة",
        "no_tables": "لا توجد طاولات بعد",
        "collaborators": "المدراء",
        "collaborator_added": "تمت إضافة مدير",
        "collaborator_exists": "المدير مضاف مسبقاً",
        "collaborator_missing_fields": "يجب إدخال اسم المستخدم وكلمة المرور",
        "password_too_short": "الحد الأدنى 8 أحرف",
        "password_requirements": "8 أحرف على الأقل مع حروف وأرقام ورمزين غير متتاليين",
        "password_no_restaurant": "يجب ألا يحتوي على اسم المطعم",
        "collaborator_removed": "تم حذف المدير",
        "password_updated": "تم تحديث كلمة المرور",
        "blocked": "محظور",
        "block": "حظر",
        "unblock": "إلغاء الحظر",
        "user_blocked_login": "الحساب محظور. اتصل بالمسؤول.",
        "user_blocked": "تم حظر المستخدم",
        "user_unblocked": "تم إلغاء حظر المستخدم",
        "cannot_block_admin": "لا يمكن حظر حساب المشرف",
        "no_categories": "لا توجد فئات بعد",
        "add_to_cart": "إضافة",
        "call_waiter": "نداء النادل",
        "orders": "الطلبات",
        "table_label": "طاولة",
        "cart_items": "عناصر",
        "clear_cart": "تنظيف",
        "cart_empty": "لا عناصر مختارة بعد",
        "cart_hide": "إخفاء",
        "cart_show": "إظهار",
        "spicy": "حار",
        "vegan": "نباتي",
        "cart_remove": "إزالة",
        "cart_increase": "زيادة",
        "cart_decrease": "تقليل",
        "new_request_alert": "طلب جديد",
        "confirm_call": "تأكيد القائمة؟",
        "history": "السجل",
        "mark_delivered": "تم التوصيل",
        "mark_canceled": "تم الإلغاء",
        "status_new": "جديد",
        "status_seen": "تمت رؤيته",
        "status_delivered": "تم التوصيل",
        "status_canceled": "تم الإلغاء",
    },
    "es": {
        "login": "Iniciar sesión",
        "register": "Registrarse",
        "logout": "Cerrar sesión",
        "admin": "Admin",
        "all_users": "Todos los usuarios",
        "all_restaurants": "Todos los restaurantes",
        "owner": "Propietario",
        "manager": "Gerente",
        "created": "Creado",
        "email": "Email",
        "username": "Usuario",
        "username_or_email": "Usuario o email",
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
        "restaurant_deleted": "Restaurante eliminado",
        "restaurant_delete_failed": "No se pudo eliminar el restaurante",
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
        "table_occupied": "Ocupada",
        "table_free": "Libre",
        "mark_occupied": "Marcar ocupada",
        "mark_free": "Marcar libre",
        "table_marked_occupied": "Mesa marcada ocupada",
        "table_marked_free": "Mesa marcada libre",
        "no_tables": "Aún no hay mesas",
        "collaborators": "Gestores",
        "collaborator_added": "Gestor añadido",
        "collaborator_exists": "Gestor ya asignado",
        "collaborator_missing_fields": "Usuario y contraseña requeridos",
        "password_too_short": "Mínimo 8 caracteres",
        "password_requirements": "8+ caracteres, letras, números y dos símbolos no consecutivos",
        "password_no_restaurant": "La contraseña no debe contener el nombre del restaurante",
        "collaborator_removed": "Gestor eliminado",
        "password_updated": "Contraseña actualizada",
        "blocked": "Bloqueado",
        "block": "Bloquear",
        "unblock": "Desbloquear",
        "user_blocked_login": "La cuenta está bloqueada. Contacte con el administrador.",
        "user_blocked": "Usuario bloqueado",
        "user_unblocked": "Usuario desbloqueado",
        "cannot_block_admin": "No se puede bloquear una cuenta de administrador",
        "no_categories": "Aún no hay categorías",
        "add_to_cart": "Añadir",
        "call_waiter": "Llamar al camarero",
        "orders": "Pedidos",
        "table_label": "Mesa",
        "cart_items": "artículos",
        "clear_cart": "Vaciar",
        "cart_empty": "Aún no hay artículos",
        "cart_hide": "Ocultar",
        "cart_show": "Mostrar",
        "spicy": "Picante",
        "vegan": "Vegano",
        "cart_remove": "Eliminar",
        "cart_increase": "Más",
        "cart_decrease": "Menos",
        "new_request_alert": "Nueva solicitud",
        "confirm_call": "¿Confirmar el menú?",
        "history": "Historial",
        "mark_delivered": "Marcar entregado",
        "mark_canceled": "Marcar cancelado",
        "status_new": "Nuevo",
        "status_seen": "Visto",
        "status_delivered": "Entregado",
        "status_canceled": "Cancelado",
    },
    "de": {
        "login": "Anmelden",
        "register": "Registrieren",
        "logout": "Abmelden",
        "admin": "Admin",
        "all_users": "Alle Benutzer",
        "all_restaurants": "Alle Restaurants",
        "owner": "Inhaber",
        "manager": "Manager",
        "created": "Erstellt",
        "email": "Email",
        "username": "Benutzername",
        "username_or_email": "Benutzername oder Email",
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
        "restaurant_deleted": "Restaurant gelöscht",
        "restaurant_delete_failed": "Restaurant konnte nicht gelöscht werden",
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
        "table_occupied": "Belegt",
        "table_free": "Frei",
        "mark_occupied": "Als belegt markieren",
        "mark_free": "Als frei markieren",
        "table_marked_occupied": "Tisch als belegt markiert",
        "table_marked_free": "Tisch als frei markiert",
        "no_tables": "Noch keine Tische",
        "collaborators": "Manager",
        "collaborator_added": "Manager hinzugefügt",
        "collaborator_exists": "Manager bereits zugeordnet",
        "collaborator_missing_fields": "Benutzername und Passwort angeben",
        "password_too_short": "Mindestens 8 Zeichen",
        "password_requirements": "Mind. 8 Zeichen, Buchstaben, Zahlen und zwei nicht aufeinanderfolgende Symbole",
        "password_no_restaurant": "Passwort darf den Restaurantnamen nicht enthalten",
        "collaborator_removed": "Manager entfernt",
        "password_updated": "Passwort aktualisiert",
        "blocked": "Gesperrt",
        "block": "Sperren",
        "unblock": "Entsperren",
        "user_blocked_login": "Konto gesperrt. Bitte den Administrator kontaktieren.",
        "user_blocked": "Benutzer gesperrt",
        "user_unblocked": "Benutzer entsperrt",
        "cannot_block_admin": "Administrator-Konto kann nicht gesperrt werden",
        "no_categories": "Noch keine Kategorien",
        "add_to_cart": "Hinzufügen",
        "call_waiter": "Kellner rufen",
        "orders": "Bestellungen",
        "table_label": "Tisch",
        "cart_items": "Artikel",
        "clear_cart": "Leeren",
        "cart_empty": "Noch keine Artikel ausgewählt",
        "spicy": "Scharf",
        "vegan": "Vegan",
        "cart_remove": "Entfernen",
        "cart_increase": "Mehr",
        "cart_decrease": "Weniger",
        "confirm_call": "Menü bestätigen?",
        "history": "Verlauf",
        "mark_delivered": "Als geliefert markieren",
        "mark_canceled": "Als storniert markieren",
        "status_new": "Neu",
        "status_seen": "Gesehen",
        "status_delivered": "Geliefert",
        "status_canceled": "Storniert",
    },
    "hi": {
        "login": "लॉगिन",
        "register": "रजिस्टर",
        "logout": "लॉगआउट",
        "admin": "एडमिन",
        "all_users": "सभी उपयोगकर्ता",
        "all_restaurants": "सभी रेस्टोरेंट",
        "owner": "मालिक",
        "manager": "प्रबंधक",
        "created": "बनाया गया",
        "email": "ईमेल",
        "username": "उपयोगकर्ता नाम",
        "username_or_email": "उपयोगकर्ता नाम या ईमेल",
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
        "restaurant_deleted": "रेस्टोरेंट हटाया गया",
        "restaurant_delete_failed": "रेस्टोरेंट हटाया नहीं जा सका",
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
        "table_occupied": "व्यस्त",
        "table_free": "खाली",
        "mark_occupied": "व्यस्त चिन्हित करें",
        "mark_free": "खाली चिन्हित करें",
        "table_marked_occupied": "टेबल को व्यस्त किया गया",
        "table_marked_free": "टेबल को खाली किया गया",
        "no_tables": "अभी कोई टेबल नहीं है",
        "collaborators": "प्रबंधक",
        "collaborator_added": "प्रबंधक जोड़ा गया",
        "collaborator_exists": "प्रबंधक पहले से जुड़ा है",
        "collaborator_missing_fields": "उपयोगकर्ता नाम और पासवर्ड आवश्यक हैं",
        "password_too_short": "कम से कम 8 वर्ण",
        "password_requirements": "पासवर्ड 8+ वर्ण का हो, अक्षर, अंक और दो अलग-अलग विशेष चिन्ह शामिल हों",
        "password_no_restaurant": "पासवर्ड में रेस्तरां का नाम नहीं होना चाहिए",
        "collaborator_removed": "प्रबंधक हटाया गया",
        "password_updated": "पासवर्ड अपडेट किया गया",
        "blocked": "ब्लॉक किया गया",
        "block": "ब्लॉक करें",
        "unblock": "ब्लॉक हटाएं",
        "user_blocked_login": "खाता ब्लॉक है। एडमिन से संपर्क करें।",
        "user_blocked": "उपयोगकर्ता ब्लॉक हुआ",
        "user_unblocked": "उपयोगकर्ता अनब्लॉक हुआ",
        "cannot_block_admin": "ऐडमिन खाते को ब्लॉक नहीं कर सकते",
        "no_categories": "अभी कैटेगरी नहीं हैं",
        "add_to_cart": "जोड़ें",
        "call_waiter": "वेटर बुलाएँ",
        "orders": "ऑर्डर",
        "table_label": "टेबल",
        "cart_items": "आइटम",
        "clear_cart": "खाली करें",
        "cart_empty": "अभी कुछ नहीं चुना",
        "spicy": "मसालेदार",
        "vegan": "वीगन",
        "cart_remove": "हटाएं",
        "cart_increase": "बढ़ाएं",
        "cart_decrease": "घटाएं",
        "confirm_call": "मेनू की पुष्टि करें?",
        "history": "इतिहास",
        "mark_delivered": "डिलीवर मार्क करें",
        "mark_canceled": "रद्द मार्क करें",
        "status_new": "नया",
        "status_seen": "देखा गया",
        "status_delivered": "डिलीवर",
        "status_canceled": "रद्द",
    },
}

ROLE_TRANSLATION_KEYS = {
    "owner": "owner",
    "manager": "manager",
    "admin": "admin",
    "superadmin": "admin",
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
    MAX_CONTENT_LENGTH=MAX_UPLOAD_BYTES,
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

VITE_DEV = "http://127.0.0.1:5173"

@app.route("/react/")
@app.route("/react/<path:path>")
def react_proxy(path=""):
    # Legacy dev-only proxy (was used before SPA static build).
    # Deprecated: run Vite directly (cd frontend && npm run dev) and access it on :5173.
    abort(404)


@app.after_request
def add_cache_headers(resp):
    try:
        path = request.path or ""
    except Exception:
        return resp

    # Harden a bit for static assets.
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")

    # SPA HTML entrypoints (served from /admin, /r, /qr, /app, /login, /register, /).
    # Never cache HTML to avoid stale deployments.
    try:
        is_html = (resp.mimetype or "").startswith("text/html")
    except Exception:
        is_html = False
    if is_html and react_build_exists() and (
        path == "/"
        or path == "/login"
        or path == "/register"
        or path.startswith("/admin")
        or path.startswith("/r")
        or path.startswith("/qr")
        or path.startswith("/app")
    ):
        resp.headers["Cache-Control"] = "no-store"
        resp.headers.add("Vary", "Accept-Encoding")
        return resp

    if path.startswith("/static/react/assets/"):
        # Vite assets are content-hashed -> safe to cache forever.
        resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        resp.headers.add("Vary", "Accept-Encoding")
        return resp

    if path.startswith("/static/react/"):
        # index.html should update immediately after deploy.
        resp.headers["Cache-Control"] = "no-store"
        resp.headers.add("Vary", "Accept-Encoding")
        return resp

    if path.startswith("/uploads/"):
        # Uploaded files can change; keep cache moderate.
        resp.headers.setdefault("Cache-Control", "public, max-age=86400")
        resp.headers.add("Vary", "Accept-Encoding")
        return resp

    if path.startswith("/api/public/"):
        # Public GET endpoints: short cache is OK; keep admin endpoints no-store.
        if request.method in {"GET", "HEAD"}:
            resp.headers.setdefault("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
            resp.headers.add("Vary", "Accept-Encoding")
        return resp

    if path.startswith("/api/"):
        resp.headers.setdefault("Cache-Control", "no-store")
        resp.headers.add("Vary", "Accept-Encoding")
        return resp

    return resp


class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(120), unique=True, nullable=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default="owner")
    is_blocked = db.Column(db.Boolean, default=False)
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
    phone = db.Column(db.String(40), nullable=True)
    whatsapp = db.Column(db.String(40), nullable=True)
    instagram = db.Column(db.String(255), nullable=True)
    facebook = db.Column(db.String(255), nullable=True)
    theme = db.Column(db.String(32), default="classic")
    menu_font = db.Column(db.String(255), default="serif")
    menu_font_size = db.Column(db.Integer, default=16)
    menu_font_brand = db.Column(db.String(255), nullable=True)
    menu_font_brand_size = db.Column(db.Integer, nullable=True)
    menu_font_category = db.Column(db.String(255), nullable=True)
    menu_font_category_size = db.Column(db.Integer, nullable=True)
    menu_font_item = db.Column(db.String(255), nullable=True)
    menu_font_item_size = db.Column(db.Integer, nullable=True)
    loading_image_path = db.Column(db.String(255), nullable=True)
    loading_style = db.Column(db.String(32), default="spinner")
    name_translations = db.Column(db.JSON, default=dict)
    description_translations = db.Column(db.JSON, default=dict)
    slug = db.Column(db.String(180), unique=True, nullable=False)
    logo_filename = db.Column(db.String(255), nullable=True)
    categories = db.relationship(
        "Category", backref="restaurant", lazy=True, cascade="all, delete-orphan", order_by="Category.sort_order"
    )
    tables = db.relationship("DiningTable", backref="restaurant", lazy=True, cascade="all, delete-orphan")
    theme_id = db.Column(db.Integer, db.ForeignKey("themes.id"), nullable=True)
    theme_overrides_json = db.Column(db.JSON, nullable=True)
    theme_ref = db.relationship("Theme", lazy=True)
    header_style_json = db.Column(db.JSON, nullable=True)
    hero_preset_id = db.Column(db.Integer, db.ForeignKey("hero_presets.id"), nullable=True)
    hero_overrides_json = db.Column(db.JSON, nullable=True)
    hero_preset_ref = db.relationship("HeroPreset", lazy=True)
    menu_card_preset_id = db.Column(db.Integer, db.ForeignKey("menu_card_presets.id"), nullable=True)
    menu_card_overrides_json = db.Column(db.JSON, nullable=True)
    menu_card_remove_bg_on_upload = db.Column(db.Boolean, default=False)

    def logo_url(self) -> str | None:
        if self.logo_filename:
            return url_for("uploaded_file", filename=self.logo_filename)
        return None

    def loading_image_url(self) -> str | None:
        if getattr(self, "loading_image_path", None):
            return url_for("uploaded_file", filename=self.loading_image_path)
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


class RestaurantUser(db.Model):
    __tablename__ = "restaurant_user"
    id = db.Column(db.Integer, primary_key=True)
    restaurant_id = db.Column(db.Integer, db.ForeignKey("restaurant.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    role = db.Column(db.String(50), default="manager")

    __table_args__ = (db.UniqueConstraint("restaurant_id", "user_id", name="uq_restaurant_user"),)


class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    sort_order = db.Column(db.Integer, default=0)
    restaurant_id = db.Column(db.Integer, db.ForeignKey("restaurant.id"), nullable=False)
    name_translations = db.Column(db.JSON, default=dict)
    icon_name = db.Column(db.String(64), nullable=True)
    image_path = db.Column(db.String(255), nullable=True)
    header_style_json = db.Column(db.JSON, nullable=True)
    dishes = db.relationship(
        "Dish",
        backref="category",
        lazy=True,
        cascade="all, delete-orphan",
        order_by="Dish.name",
    )

    def image_url(self) -> str | None:
        if self.image_path:
            return url_for("uploaded_file", filename=self.image_path)
        return None

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
    is_spicy = db.Column(db.Boolean, default=False)
    is_vegan = db.Column(db.Boolean, default=False)
    image_filename = db.Column(db.String(255), nullable=True)
    image_variants_json = db.Column(db.JSON, nullable=True)
    processed_image_filename = db.Column(db.String(255), nullable=True)
    processed_image_variants_json = db.Column(db.JSON, nullable=True)
    image_remove_bg_status = db.Column(db.String(32), nullable=True)
    image_remove_bg_error = db.Column(db.String(255), nullable=True)
    use_processed_image = db.Column(db.Boolean, default=False)
    currency = db.Column(db.String(8), nullable=False, default="AMD")
    name_translations = db.Column(db.JSON, default=dict)
    description_translations = db.Column(db.JSON, default=dict)
    category_id = db.Column(db.Integer, db.ForeignKey("category.id"), nullable=False)

    def image_url(self) -> str | None:
        use_processed = bool(getattr(self, "use_processed_image", False))
        processed = getattr(self, "processed_image_filename", None)
        status = getattr(self, "image_remove_bg_status", None)
        if use_processed and processed and status == "done":
            return url_for("uploaded_file", filename=processed)
        if self.image_filename:
            return url_for("uploaded_file", filename=self.image_filename)
        return None

    def image_srcset(self) -> str | None:
        use_processed = bool(getattr(self, "use_processed_image", False))
        processed = getattr(self, "processed_image_filename", None)
        status = getattr(self, "image_remove_bg_status", None)
        variants = getattr(self, "processed_image_variants_json", None) if use_processed and processed and status == "done" else getattr(self, "image_variants_json", None)
        if not isinstance(variants, dict):
            return None
        parts = []
        for k, v in sorted(variants.items(), key=lambda kv: int(kv[0]) if str(kv[0]).isdigit() else 10**9):
            try:
                w = int(k)
            except Exception:
                continue
            if not isinstance(v, str) or not v:
                continue
            parts.append(f"{url_for('uploaded_file', filename=v)} {w}w")
        return ", ".join(parts) if parts else None

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


class DishTranslation(db.Model):
    __tablename__ = "dish_translations"
    id = db.Column(db.Integer, primary_key=True)
    dish_id = db.Column(db.Integer, db.ForeignKey("dish.id", ondelete="CASCADE"), nullable=False)
    lang = db.Column(db.String(12), nullable=False)
    auto_title = db.Column(db.Text, nullable=True)
    auto_description = db.Column(db.Text, nullable=True)
    manual_title = db.Column(db.Text, nullable=True)
    manual_description = db.Column(db.Text, nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    dish = db.relationship(
        "Dish",
        backref=db.backref("translations", cascade="all, delete-orphan"),
    )

    __table_args__ = (db.UniqueConstraint("dish_id", "lang", name="uq_dish_translation"),)


class MenuCardPreset(db.Model):
    __tablename__ = "menu_card_presets"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    key = db.Column(db.String(80), unique=True, nullable=False)
    is_builtin = db.Column(db.Boolean, default=False)
    config_json = db.Column(db.JSON, default=dict)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DishImageJob(db.Model):
    __tablename__ = "dish_image_jobs"
    id = db.Column(db.Integer, primary_key=True)
    dish_id = db.Column(db.Integer, db.ForeignKey("dish.id", ondelete="CASCADE"), nullable=False)
    job_type = db.Column(db.String(32), nullable=False, default="remove_bg")
    status = db.Column(db.String(32), nullable=False, default="queued")  # queued|processing|done|failed
    input_filename = db.Column(db.String(255), nullable=True)
    output_filename = db.Column(db.String(255), nullable=True)
    error = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    dish = db.relationship(
        "Dish",
        backref=db.backref("image_jobs", cascade="all, delete-orphan"),
    )


class Theme(db.Model):
    __tablename__ = "themes"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    preset_key = db.Column(db.String(80), unique=True, nullable=False)
    config_json = db.Column(db.JSON, default=dict)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class HeroPreset(db.Model):
    __tablename__ = "hero_presets"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    key = db.Column(db.String(80), unique=True, nullable=False)
    is_builtin = db.Column(db.Boolean, default=False)
    config_json = db.Column(db.JSON, default=dict)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


def deep_merge_dict(base: dict, overrides: dict) -> dict:
    result = copy.deepcopy(base or {})
    for k, v in (overrides or {}).items():
        if isinstance(v, dict) and isinstance(result.get(k), dict):
            result[k] = deep_merge_dict(result.get(k) or {}, v)
        else:
            result[k] = v
    return result


DEFAULT_THEME_PRESET = "burger_orange"

THEME_PRESETS: dict[str, dict] = {
    "burger_orange": {
        "name": "Burger Orange",
        "category_layout": "pills",
        "transition": "pageCurlLite",
        "card_style": "glass",
        "vars": {
            "--pm-bg": "#FFF4E6",
            "--pm-card": "rgba(255,255,255,0.68)",
            "--pm-border": "rgba(12,7,3,0.10)",
            "--pm-text": "rgba(12,7,3,0.96)",
            "--pm-muted": "rgba(12,7,3,0.55)",
            "--pm-accent": "#F39A1E",
            "--pm-accent-2": "#FFB64D",
            "--pm-accent-3": "#FFCF7D",
            "--pm-category": "#F39A1E",
            "--pm-shadow": "0 14px 40px rgba(12, 7, 3, 0.14)",
            "--pm-shadow-soft": "0 10px 26px rgba(12, 7, 3, 0.12)",
            "--pm-radius-lg": "22px",
            "--pm-radius-xl": "28px",
        },
    },
    "coffee_minimal": {
        "name": "Coffee Minimal",
        "category_layout": "gridCards",
        "transition": "slide",
        "card_style": "flat",
        "vars": {
            "--pm-bg": "#F6F1EA",
            "--pm-card": "rgba(255,255,255,0.98)",
            "--pm-border": "rgba(60,45,34,0.14)",
            "--pm-text": "rgba(28,20,14,0.96)",
            "--pm-muted": "rgba(28,20,14,0.55)",
            "--pm-accent": "#3C2D22",
            "--pm-accent-2": "#6B4F3A",
            "--pm-accent-3": "#B89A7C",
            "--pm-category": "#3C2D22",
            "--pm-shadow": "0 10px 30px rgba(28, 20, 14, 0.10)",
            "--pm-shadow-soft": "0 8px 20px rgba(28, 20, 14, 0.08)",
            "--pm-radius-lg": "18px",
            "--pm-radius-xl": "22px",
        },
    },
    "sushi_neon": {
        "name": "Sushi Neon",
        "category_layout": "carousel",
        "transition": "slide",
        "card_style": "glow",
        "vars": {
            "--pm-bg": "#0B0B10",
            "--pm-card": "rgba(18,18,26,0.75)",
            "--pm-border": "rgba(255,255,255,0.10)",
            "--pm-text": "rgba(255,255,255,0.95)",
            "--pm-muted": "rgba(255,255,255,0.65)",
            "--pm-accent": "#00F5D4",
            "--pm-accent-2": "#F15BB5",
            "--pm-accent-3": "#00BBF9",
            "--pm-category": "#1B1B26",
            "--pm-shadow": "0 16px 44px rgba(0, 245, 212, 0.14)",
            "--pm-shadow-soft": "0 12px 30px rgba(241, 91, 181, 0.10)",
            "--pm-radius-lg": "22px",
            "--pm-radius-xl": "28px",
        },
    },
}

DEFAULT_HERO_PRESET_KEY = "premiumHaloGlass"

HERO_PRESETS: dict[str, dict] = {
    "minimalClean": {
        "name": "Minimal Clean",
        "config_json": {
            "backgroundMode": "solid",
            "bgSolid": "#FFF6EE",
            "bgGradient": ["#FFF6EE", "#FFE8D2"],
            "accentColor": "#F39A1E",
            "badgeShape": "rounded",
            "badgeBlur": 0,
            "badgeOpacity": 0.0,
            "badgeBorderOpacity": 0.0,
            "logoSize": 72,
            "glowStrength": 0.0,
            "glowRadius": 18,
            "fadeStrength": 0.55,
            "paddingTop": 16,
            "paddingBottom": 18,
            "radius": 22,
        },
    },
    "premiumHaloGlass": {
        "name": "Premium Halo Glass",
        "config_json": {
            "backgroundMode": "gradient",
            "bgSolid": "#FFF3E6",
            "bgGradient": ["#FFF3E6", "#FFE1B8"],
            "accentColor": "#F39A1E",
            "badgeShape": "circle",
            "badgeBlur": 14,
            "badgeOpacity": 0.78,
            "badgeBorderOpacity": 0.35,
            "logoSize": 76,
            "glowStrength": 0.55,
            "glowRadius": 26,
            "fadeStrength": 0.75,
            "paddingTop": 18,
            "paddingBottom": 22,
            "radius": 26,
        },
    },
    "neonNight": {
        "name": "Neon Night",
        "config_json": {
            "backgroundMode": "gradient",
            "bgSolid": "#0B0B10",
            "bgGradient": ["#0B0B10", "#141426"],
            "accentColor": "#00F5D4",
            "badgeShape": "circle",
            "badgeBlur": 10,
            "badgeOpacity": 0.42,
            "badgeBorderOpacity": 0.22,
            "logoSize": 74,
            "glowStrength": 0.7,
            "glowRadius": 30,
            "fadeStrength": 0.65,
            "paddingTop": 18,
            "paddingBottom": 22,
            "radius": 26,
        },
    },
}

DEFAULT_MENU_CARD_PRESET_KEY = "warmFood"

MENU_CARD_PRESETS: dict[str, dict] = {
    "minimalClean": {
        "name": "Minimal Clean",
        "config_json": {
            "preset": "minimalClean",
            "layout": "grid",
            "cardRadius": 22,
            "cardBorderOpacity": 0.12,
            "cardShadow": 0.10,
            "imageRatio": "1:1",
            "imageFit": "cover",
            "imagePadding": 0,
            "imageBgMode": "solid",
            "imageBgColors": ["#FFFFFF", "#FFFFFF"],
        },
    },
    "warmFood": {
        "name": "Warm Food",
        "config_json": {
            "preset": "warmFood",
            "layout": "grid",
            "cardRadius": 24,
            "cardBorderOpacity": 0.10,
            "cardShadow": 0.18,
            "imageRatio": "4:3",
            "imageFit": "cover",
            "imagePadding": 0,
            "imageBgMode": "gradient",
            "imageBgColors": ["#FFF0D9", "#FFE6C4"],
        },
    },
    "glassModern": {
        "name": "Glass Modern",
        "config_json": {
            "preset": "glassModern",
            "layout": "grid",
            "cardRadius": 24,
            "cardBorderOpacity": 0.14,
            "cardShadow": 0.22,
            "imageRatio": "1:1",
            "imageFit": "cover",
            "imagePadding": 0,
            "imageBgMode": "gradient",
            "imageBgColors": ["#FBE7D2", "#E7F6FF"],
        },
    },
    "darkNeon": {
        "name": "Dark Neon",
        "config_json": {
            "preset": "darkNeon",
            "layout": "grid",
            "cardRadius": 22,
            "cardBorderOpacity": 0.18,
            "cardShadow": 0.26,
            "imageRatio": "1:1",
            "imageFit": "cover",
            "imagePadding": 0,
            "imageBgMode": "solid",
            "imageBgColors": ["#12121A", "#12121A"],
        },
    },
    "compactList": {
        "name": "Compact List",
        "config_json": {
            "preset": "compactList",
            "layout": "compact",
            "cardRadius": 22,
            "cardBorderOpacity": 0.12,
            "cardShadow": 0.12,
            "imageRatio": "1:1",
            "imageFit": "cover",
            "imagePadding": 0,
            "imageBgMode": "gradient",
            "imageBgColors": ["#FFF0D9", "#FFE6C4"],
        },
    },
}


def api_theme_dict(theme: Theme) -> dict:
    return {
        "id": theme.id,
        "name": theme.name,
        "preset_key": theme.preset_key,
        "config_json": theme.config_json or {},
    }

    def currency_symbol(self) -> str:
        return CURRENCY_SYMBOLS.get(self.currency or "AMD", "֏")


class DiningTable(db.Model):
    __tablename__ = "restaurant_tables"
    id = db.Column(db.Integer, primary_key=True)
    number = db.Column(db.Integer, nullable=False)
    restaurant_id = db.Column(db.Integer, db.ForeignKey("restaurant.id"), nullable=False)
    is_occupied = db.Column(db.Boolean, default=False)

    __table_args__ = (db.UniqueConstraint("restaurant_id", "number", name="uq_table_number_per_restaurant"),)


class CallRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    restaurant_id = db.Column(db.Integer, db.ForeignKey("restaurant.id"), nullable=False)
    table_number = db.Column(db.Integer, nullable=False)
    items = db.Column(db.JSON, default=list)
    status = db.Column(db.String(20), default="new")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    restaurant = db.relationship(
        "Restaurant", backref=db.backref("call_requests", cascade="all, delete-orphan")
    )

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


def ensure_table_occupancy_column() -> None:
    """Ensure legacy DBs have the is_occupied column on both possible table names."""
    try:
        with app.app_context():
            for tbl_name in ("restaurant_tables", "table"):
                try:
                    db.session.execute(text(f"ALTER TABLE `{tbl_name}` ADD COLUMN is_occupied TINYINT(1) NOT NULL DEFAULT 0"))
                    db.session.commit()
                except Exception:
                    db.session.rollback()
    except Exception:
        pass


ensure_table_occupancy_column()


def ensure_collaborator_table() -> None:
    """Create restaurant_user helper table if missing."""
    try:
        with app.app_context():
            db.session.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS `restaurant_user` (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        restaurant_id INT NOT NULL,
                        user_id INT NOT NULL,
                        role VARCHAR(50) DEFAULT 'manager',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE KEY uq_restaurant_user (restaurant_id, user_id),
                        KEY idx_restaurant_user_rest (restaurant_id),
                        KEY idx_restaurant_user_user (user_id),
                        CONSTRAINT fk_ru_rest FOREIGN KEY (restaurant_id) REFERENCES restaurant(id) ON DELETE CASCADE,
                        CONSTRAINT fk_ru_user FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
                    )
                    """
                )
            )
            db.session.commit()
    except Exception:
        db.session.rollback()


ensure_collaborator_table()


def ensure_username_column() -> None:
    """Add username column if missing (unique, nullable)."""
    try:
        with app.app_context():
            inspector = inspect(db.engine)
            columns = {col["name"] for col in inspector.get_columns("user")} if inspector.has_table("user") else set()
            if "username" not in columns:
                try:
                    with db.engine.begin() as conn:
                        conn.execute(text("ALTER TABLE `user` ADD COLUMN username VARCHAR(120) UNIQUE"))
                except Exception:
                    pass
    except Exception:
        pass


ensure_username_column()


def ensure_user_role_column() -> None:
    """Normalize roles: default to owner, demote stale admins to owner, reapply .env admins."""
    try:
        with app.app_context():
            try:
                db.session.execute(text("ALTER TABLE `user` ADD COLUMN role VARCHAR(20) DEFAULT 'owner'"))
            except Exception:
                db.session.rollback()
            try:
                db.session.execute(
                    text("UPDATE `user` SET role = 'owner' WHERE role IS NULL OR role = '' OR role = 'user'")
                )
                # Demote any lingering admins to owner before reapplying env admins
                db.session.execute(text("UPDATE `user` SET role = 'owner' WHERE role IN ('admin', 'superadmin')"))
                if ADMIN_EMAILS:
                    for email in ADMIN_EMAILS:
                        db.session.execute(
                            text("UPDATE `user` SET role = 'admin' WHERE LOWER(email) = :email"),
                            {"email": email.lower()},
                        )
                db.session.commit()
            except Exception:
                db.session.rollback()
    except Exception:
        pass


ensure_user_role_column()


def ensure_user_blocked_column() -> None:
    """Add is_blocked flag to users for admin lockout control."""
    try:
        with app.app_context():
            inspector = inspect(db.engine)
            if not inspector.has_table("user"):
                return
            columns = {col["name"] for col in inspector.get_columns("user")}
            if "is_blocked" not in columns:
                try:
                    db.session.execute(text("ALTER TABLE `user` ADD COLUMN is_blocked TINYINT(1) DEFAULT 0"))
                    db.session.commit()
                except Exception:
                    db.session.rollback()
    except Exception:
        pass


ensure_user_blocked_column()


def ensure_username_values() -> None:
    """Backfill usernames for users missing them."""
    try:
        with app.app_context():
            inspector = inspect(db.engine)
            if not inspector.has_table("user"):
                return
            missing = User.query.filter((User.username == None) | (User.username == "")).all()  # noqa: E711
            changed = False
            for user in missing:
                base = (user.email or "").split("@")[0] or secrets.token_hex(3)
                user.username = unique_username(base)
                changed = True
            if changed:
                db.session.commit()
    except Exception:
        db.session.rollback()


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


def sanitize_username(raw: str) -> str:
    cleaned = slugify(raw).replace("-", "")
    if not cleaned:
        cleaned = slugify(raw)
    cleaned = cleaned or secrets.token_hex(3)
    return cleaned[:60]


def unique_username(raw: str) -> str:
    base_username = sanitize_username(raw)
    candidate = base_username
    index = 1
    while User.query.filter_by(username=candidate).first():
        candidate = f"{base_username}-{index}"
        index += 1
    return candidate


def generate_manager_email(username: str, restaurant: Restaurant | None = None) -> str:
    suffix = "manager.local"
    if restaurant and restaurant.slug:
        suffix = f"manager.{restaurant.slug}"
    base_email = f"{username}@{suffix}"
    candidate = base_email
    index = 1
    while User.query.filter_by(email=candidate).first():
        candidate = f"{username}-{index}@{suffix}"
        index += 1
    return candidate


ensure_username_values()


@app.route("/api/username_suggestions")
@login_required
def api_username_suggestions():
    query = (request.args.get("q") or "").strip()
    sanitized = sanitize_username(query)
    if not sanitized:
        return api_success({"suggestions": []})
    suggestions: list[str] = []
    base = sanitized
    idx = 0
    while len(suggestions) < 5 and idx < 20:
        candidate = base if idx == 0 else f"{base}-{idx}"
        exists = User.query.filter(or_(User.username == candidate, User.email == generate_manager_email(candidate))).first()
        if not exists:
            suggestions.append(candidate)
        idx += 1
    return api_success({"suggestions": suggestions})


ensure_username_values()


class ApiUploadError(Exception):
    def __init__(self, code: str, message: str, *, status: int = 400, details=None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.details = details


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


def save_image_upload(file_storage, folder: Path, *, field_name: str = "file") -> str:
    """Save a validated image (JPG/PNG/WEBP) into uploads and return relative path."""
    if not file_storage or not getattr(file_storage, "filename", None):
        raise ApiUploadError("VALIDATION_ERROR", f"Файл {field_name} обязателен", status=400)

    filename = secure_filename(file_storage.filename)
    if not filename:
        raise ApiUploadError("VALIDATION_ERROR", "Некорректное имя файла", status=400)

    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTS:
        raise ApiUploadError(
            "UNSUPPORTED_MEDIA_TYPE",
            "Разрешены только JPG/PNG/WEBP",
            status=415,
            details={"allowed_exts": sorted(ALLOWED_IMAGE_EXTS)},
        )

    mimetype = (getattr(file_storage, "mimetype", "") or "").lower()
    if mimetype and mimetype not in ALLOWED_IMAGE_MIMES:
        raise ApiUploadError(
            "UNSUPPORTED_MEDIA_TYPE",
            "Разрешены только JPG/PNG/WEBP",
            status=415,
            details={"allowed_mimes": sorted(ALLOWED_IMAGE_MIMES)},
        )

    file_format = None
    try:
        try:
            file_storage.stream.seek(0)
        except Exception:
            pass
        with Image.open(file_storage.stream) as img:
            img.verify()
            file_format = (img.format or "").upper()
    except UnidentifiedImageError:
        raise ApiUploadError("UNSUPPORTED_MEDIA_TYPE", "Файл не является корректным изображением", status=415)
    except Exception:
        raise ApiUploadError("UNSUPPORTED_MEDIA_TYPE", "Файл не является корректным изображением", status=415)
    finally:
        try:
            file_storage.stream.seek(0)
        except Exception:
            pass

    fmt_to_ext = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}
    normalized_ext = fmt_to_ext.get(file_format)
    if not normalized_ext:
        raise ApiUploadError("UNSUPPORTED_MEDIA_TYPE", "Разрешены только JPG/PNG/WEBP", status=415)

    unique_name = f"{secrets.token_hex(8)}{normalized_ext}"
    destination = folder / unique_name
    file_storage.save(destination)
    return str(destination.relative_to(UPLOAD_ROOT))


def save_dish_image_upload(file_storage, folder: Path, *, field_name: str = "image", max_px: int = DISH_IMAGE_MAX_PX) -> str:
    """Save an optimized dish image as WEBP with a consistent max dimension."""
    if not file_storage or not getattr(file_storage, "filename", None):
        raise ApiUploadError("VALIDATION_ERROR", f"Файл {field_name} обязателен", status=400)

    filename = secure_filename(file_storage.filename)
    if not filename:
        raise ApiUploadError("VALIDATION_ERROR", "Некорректное имя файла", status=400)

    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTS:
        raise ApiUploadError(
            "UNSUPPORTED_MEDIA_TYPE",
            "Разрешены только JPG/PNG/WEBP",
            status=415,
            details={"allowed_exts": sorted(ALLOWED_IMAGE_EXTS)},
        )

    mimetype = (getattr(file_storage, "mimetype", "") or "").lower()
    if mimetype and mimetype not in ALLOWED_IMAGE_MIMES:
        raise ApiUploadError(
            "UNSUPPORTED_MEDIA_TYPE",
            "Разрешены только JPG/PNG/WEBP",
            status=415,
            details={"allowed_mimes": sorted(ALLOWED_IMAGE_MIMES)},
        )

    size = get_filestorage_size(file_storage)
    if size is not None and size > MAX_UPLOAD_BYTES:
        raise ApiUploadError("PAYLOAD_TOO_LARGE", f"Файл слишком большой (max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB)", status=413)

    folder.mkdir(parents=True, exist_ok=True)

    try:
        try:
            file_storage.stream.seek(0)
        except Exception:
            pass
        with Image.open(file_storage.stream) as img:
            img = ImageOps.exif_transpose(img)
            img.load()
            if img.mode in ("RGBA", "LA"):
                bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
                bg.alpha_composite(img.convert("RGBA"))
                img = bg.convert("RGB")
            else:
                img = img.convert("RGB")

            max_px = int(max_px) if isinstance(max_px, int) else DISH_IMAGE_MAX_PX
            max_px = max(240, min(1600, max_px))
            if img.width > max_px or img.height > max_px:
                img.thumbnail((max_px, max_px), Image.LANCZOS)

            quality = int(DISH_IMAGE_QUALITY) if isinstance(DISH_IMAGE_QUALITY, int) else 82
            quality = max(60, min(92, quality))
            unique_name = f"{secrets.token_hex(10)}.webp"
            destination = folder / unique_name
            img.save(destination, format="WEBP", quality=quality, method=6)
            return str(destination.relative_to(UPLOAD_ROOT))
    except UnidentifiedImageError:
        raise ApiUploadError("UNSUPPORTED_MEDIA_TYPE", "Файл не является корректным изображением", status=415)
    except ApiUploadError:
        raise
    except Exception:
        raise ApiUploadError("UNSUPPORTED_MEDIA_TYPE", "Файл не является корректным изображением", status=415)
    finally:
        try:
            file_storage.stream.seek(0)
        except Exception:
            pass


def _dish_variant_sizes() -> list[int]:
    # Keep a small first size for mobile 2-col grids (≈180–220px per image).
    return [240, 480, 720, 1024]


def build_dish_image_variants(rel_filename: str, *, sizes: list[int] | None = None) -> dict:
    """Create responsive WEBP variants under uploads/dishes/variants and return {width: rel_path}."""
    if not rel_filename:
        return {}
    sizes = sizes or _dish_variant_sizes()
    try:
        sizes = sorted({int(s) for s in sizes if int(s) > 0})
    except Exception:
        sizes = _dish_variant_sizes()

    src_path = (UPLOAD_ROOT / rel_filename).resolve()
    if not src_path.is_file():
        return {}

    variants_dir = (DISH_FOLDER / "variants")
    variants_dir.mkdir(parents=True, exist_ok=True)
    stem = src_path.stem

    out: dict = {}
    try:
        with Image.open(src_path) as img:
            img = ImageOps.exif_transpose(img)
            img.load()
            img = img.convert("RGB")
            orig_w = int(img.width) if img.width else 0

            for w in sizes:
                if w < 240:
                    continue
                if w > 2048:
                    continue
                target = img.copy()
                if target.width > w:
                    ratio = w / float(target.width)
                    h = max(1, int(round(target.height * ratio)))
                    target = target.resize((w, h), Image.LANCZOS)
                else:
                    # Use original if smaller, but still store a single "original width" entry.
                    w = int(target.width)
                    if str(w) in out:
                        break

                quality = int(DISH_IMAGE_QUALITY) if isinstance(DISH_IMAGE_QUALITY, int) else 82
                quality = max(60, min(92, quality))
                filename = f"{stem}-w{w}.webp"
                dest = variants_dir / filename
                target.save(dest, format="WEBP", quality=quality, method=6)
                out[str(w)] = str(dest.relative_to(UPLOAD_ROOT))
                if orig_w and w == orig_w:
                    break
    except Exception:
        return {}

    return out


def _try_remove_bg_bytes(input_bytes: bytes) -> bytes:
    """Remove background using rembg if available (returns PNG bytes with alpha)."""
    try:
        from rembg import remove  # type: ignore
    except Exception as e:
        raise RuntimeError("rembg is not installed") from e
    return remove(input_bytes)


def _trim_transparent_edges(img: Image.Image, *, padding: int = 18) -> Image.Image:
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    alpha = img.split()[-1]
    bbox = alpha.getbbox()
    if not bbox:
        return img
    cropped = img.crop(bbox)
    pad = max(0, int(padding))
    if pad <= 0:
        return cropped
    out = Image.new("RGBA", (cropped.width + pad * 2, cropped.height + pad * 2), (0, 0, 0, 0))
    out.alpha_composite(cropped, (pad, pad))
    return out


def enqueue_dish_remove_bg_job(dish: Dish) -> DishImageJob:
    job = DishImageJob(
        dish_id=dish.id,
        job_type="remove_bg",
        status="queued",
        input_filename=dish.image_filename,
    )
    db.session.add(job)
    dish.image_remove_bg_status = "queued"
    dish.image_remove_bg_error = None
    dish.use_processed_image = False
    return job


def process_one_dish_image_job(job: DishImageJob) -> bool:
    if not job or job.status not in ("queued", "processing"):
        return False
    dish = db.session.get(Dish, job.dish_id) if job.dish_id else None
    if not dish:
        job.status = "failed"
        job.error = "Dish not found"
        return True

    src_rel = job.input_filename or dish.image_filename
    if not src_rel:
        job.status = "failed"
        job.error = "No input image"
        dish.image_remove_bg_status = "failed"
        dish.image_remove_bg_error = "No input image"
        return True

    src_path = (UPLOAD_ROOT / src_rel).resolve()
    if not src_path.is_file():
        job.status = "failed"
        job.error = "Input file missing"
        dish.image_remove_bg_status = "failed"
        dish.image_remove_bg_error = "Input file missing"
        return True

    job.status = "processing"
    dish.image_remove_bg_status = "processing"
    dish.image_remove_bg_error = None
    db.session.commit()

    processed_dir = (DISH_FOLDER / "processed")
    processed_dir.mkdir(parents=True, exist_ok=True)
    out_name = f"{src_path.stem}-bg.webp"
    out_path = (processed_dir / out_name)

    try:
        input_bytes = src_path.read_bytes()
        out_bytes = _try_remove_bg_bytes(input_bytes)
        with Image.open(io.BytesIO(out_bytes)) as img:
            img = ImageOps.exif_transpose(img)
            img.load()
            img = img.convert("RGBA")
            img = _trim_transparent_edges(img, padding=18)
            img.save(out_path, format="WEBP", quality=92, method=6)

        rel_out = str(out_path.relative_to(UPLOAD_ROOT))
        variants = build_dish_image_variants(rel_out, sizes=_dish_variant_sizes())
        dish.processed_image_filename = rel_out
        dish.processed_image_variants_json = variants or None
        dish.image_remove_bg_status = "done"
        dish.image_remove_bg_error = None
        dish.use_processed_image = True
        job.status = "done"
        job.output_filename = rel_out
        job.error = None
    except Exception as e:
        job.status = "failed"
        job.error = str(e)[:250]
        dish.image_remove_bg_status = "failed"
        dish.image_remove_bg_error = str(e)[:250]

    db.session.commit()
    return True


def process_pending_dish_image_jobs(limit: int = 3) -> int:
    limit = max(1, min(int(limit or 3), 20))
    jobs = DishImageJob.query.filter(DishImageJob.status == "queued").order_by(DishImageJob.id.asc()).limit(limit).all()
    count = 0
    for job in jobs:
        try:
            if process_one_dish_image_job(job):
                count += 1
        except Exception:
            try:
                job.status = "failed"
                job.error = "Unhandled error"
                dish = db.session.get(Dish, job.dish_id) if job.dish_id else None
                if dish:
                    dish.image_remove_bg_status = "failed"
                    dish.image_remove_bg_error = "Unhandled error"
                db.session.commit()
            except Exception:
                db.session.rollback()
    return count

SVG_BLOCKLIST = ("<script", "onload=", "javascript:", "<foreignobject")


def get_filestorage_size(file_storage) -> int | None:
    size = getattr(file_storage, "content_length", None)
    try:
        if isinstance(size, int) and size >= 0:
            return size
    except Exception:
        pass
    try:
        pos = file_storage.stream.tell()
        file_storage.stream.seek(0, os.SEEK_END)
        end = file_storage.stream.tell()
        file_storage.stream.seek(pos)
        if isinstance(end, int) and end >= 0:
            return end
    except Exception:
        return None
    return None


def validate_svg_bytes(data: bytes) -> None:
    # Minimal SVG sanitization: reject obvious scripting vectors.
    text = data.decode("utf-8", errors="ignore").lower()
    if "<svg" not in text:
        raise ApiUploadError("UNSUPPORTED_MEDIA_TYPE", "SVG файл некорректен", status=415)
    for marker in SVG_BLOCKLIST:
        if marker in text:
            raise ApiUploadError("UNSUPPORTED_MEDIA_TYPE", "SVG содержит потенциально опасный код", status=415)


def save_logo_upload(file_storage, folder: Path, *, field_name: str = "logo") -> str:
    """Save a validated restaurant logo (SVG or raster) into uploads and return relative path."""
    if not file_storage or not getattr(file_storage, "filename", None):
        raise ApiUploadError("VALIDATION_ERROR", f"Файл {field_name} обязателен", status=400)

    filename = secure_filename(file_storage.filename)
    if not filename:
        raise ApiUploadError("VALIDATION_ERROR", "Некорректное имя файла", status=400)

    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_LOGO_EXTS:
        raise ApiUploadError(
            "UNSUPPORTED_MEDIA_TYPE",
            "Разрешены только SVG/PNG (JPG/WEBP дополнительно)",
            status=415,
            details={"allowed_exts": sorted(ALLOWED_LOGO_EXTS)},
        )

    mimetype = (getattr(file_storage, "mimetype", "") or "").lower()
    if mimetype and mimetype not in ALLOWED_LOGO_MIMES:
        raise ApiUploadError(
            "UNSUPPORTED_MEDIA_TYPE",
            "Неподдерживаемый MIME тип",
            status=415,
            details={"allowed_mimes": sorted(ALLOWED_LOGO_MIMES)},
        )

    folder.mkdir(parents=True, exist_ok=True)

    if ext == ".svg":
        size = get_filestorage_size(file_storage)
        if size is None:
            try:
                file_storage.stream.seek(0)
            except Exception:
                pass
            head = file_storage.stream.read(MAX_LOGO_BYTES + 1) or b""
            try:
                file_storage.stream.seek(0)
            except Exception:
                pass
            size = len(head)
        if size > MAX_LOGO_BYTES:
            raise ApiUploadError(
                "PAYLOAD_TOO_LARGE",
                f"Файл слишком большой (max {MAX_LOGO_BYTES // (1024 * 1024)} MB)",
                status=413,
            )
        data = file_storage.read() or b""
        if len(data) > MAX_LOGO_BYTES:
            raise ApiUploadError(
                "PAYLOAD_TOO_LARGE",
                f"Файл слишком большой (max {MAX_LOGO_BYTES // (1024 * 1024)} MB)",
                status=413,
            )
        validate_svg_bytes(data)
        unique_name = f"{secrets.token_hex(10)}.svg"
        destination = folder / unique_name
        destination.write_bytes(data)
        return str(destination.relative_to(UPLOAD_ROOT))

    return save_image_upload(file_storage, folder, field_name=field_name)


def safe_delete_uploaded_file(rel_path: str | None, *, required_top_dir: str | None = None) -> bool:
    """Best-effort delete of an uploads/* file by relative path."""
    if not rel_path:
        return False
    try:
        rel = Path(str(rel_path))
    except Exception:
        return False
    if rel.is_absolute():
        return False
    if ".." in rel.parts:
        return False
    if required_top_dir and (not rel.parts or rel.parts[0] != required_top_dir):
        return False

    try:
        full = (UPLOAD_ROOT / rel).resolve()
        uploads_root = UPLOAD_ROOT.resolve()
        if uploads_root not in full.parents and full != uploads_root:
            return False
        if required_top_dir:
            allowed_root = (UPLOAD_ROOT / required_top_dir).resolve()
            if allowed_root not in full.parents and full != allowed_root:
                return False
        if full.is_file():
            full.unlink(missing_ok=True)
            return True
    except Exception:
        return False
    return False


def validate_avif_header(file_storage) -> None:
    try:
        file_storage.stream.seek(0)
    except Exception:
        pass
    header = file_storage.stream.read(64) or b""
    try:
        file_storage.stream.seek(0)
    except Exception:
        pass
    # AVIF is ISO BMFF-based and typically contains "ftyp" + "avif"/"avis".
    header_lower = header.lower()
    if b"ftyp" not in header_lower or (b"avif" not in header_lower and b"avis" not in header_lower):
        raise ApiUploadError("UNSUPPORTED_MEDIA_TYPE", "AVIF файл некорректен", status=415)


def save_category_icon_thumbnail(file_storage, folder: Path, *, max_px: int = CATEGORY_ICON_MAX_PX) -> str:
    """Save a small WEBP thumbnail (max_px x max_px) for category icons."""
    try:
        try:
            file_storage.stream.seek(0)
        except Exception:
            pass
        with Image.open(file_storage.stream) as img:
            img.load()
            img = img.convert("RGBA")
            img.thumbnail((max_px, max_px), Image.LANCZOS)
            unique_name = f"{secrets.token_hex(10)}.webp"
            destination = folder / unique_name
            img.save(destination, format="WEBP", quality=82, method=6)
            return str(destination.relative_to(UPLOAD_ROOT))
    except UnidentifiedImageError:
        raise ApiUploadError("UNSUPPORTED_MEDIA_TYPE", "Файл не является корректным изображением", status=415)
    except ApiUploadError:
        raise
    except Exception:
        raise ApiUploadError("UNSUPPORTED_MEDIA_TYPE", "Файл не является корректным изображением", status=415)
    finally:
        try:
            file_storage.stream.seek(0)
        except Exception:
            pass


def save_category_icon_upload(file_storage, folder: Path, *, field_name: str = "file") -> str:
    if not file_storage or not getattr(file_storage, "filename", None):
        raise ApiUploadError("VALIDATION_ERROR", f"Файл {field_name} обязателен", status=400)

    filename = secure_filename(file_storage.filename)
    if not filename:
        raise ApiUploadError("VALIDATION_ERROR", "Некорректное имя файла", status=400)

    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_CATEGORY_ICON_EXTS:
        raise ApiUploadError(
            "UNSUPPORTED_MEDIA_TYPE",
            "Разрешены только SVG/AVIF (PNG/JPG/WEBP дополнительно)",
            status=415,
            details={"allowed_exts": sorted(ALLOWED_CATEGORY_ICON_EXTS)},
        )

    mimetype = (getattr(file_storage, "mimetype", "") or "").lower()
    if mimetype and mimetype not in ALLOWED_CATEGORY_ICON_MIMES:
        raise ApiUploadError(
            "UNSUPPORTED_MEDIA_TYPE",
            "Неподдерживаемый MIME тип",
            status=415,
            details={"allowed_mimes": sorted(ALLOWED_CATEGORY_ICON_MIMES)},
        )

    size = get_filestorage_size(file_storage)
    if size is None:
        try:
            file_storage.stream.seek(0)
        except Exception:
            pass
        head = file_storage.stream.read(MAX_CATEGORY_ICON_BYTES + 1) or b""
        try:
            file_storage.stream.seek(0)
        except Exception:
            pass
        size = len(head)
    if size > MAX_CATEGORY_ICON_BYTES:
        raise ApiUploadError(
            "PAYLOAD_TOO_LARGE",
            f"Файл слишком большой (max {MAX_CATEGORY_ICON_BYTES // (1024 * 1024)} MB)",
            status=413,
        )

    folder.mkdir(parents=True, exist_ok=True)

    if ext == ".svg":
        data = file_storage.read() or b""
        if len(data) > MAX_CATEGORY_ICON_BYTES:
            raise ApiUploadError(
                "PAYLOAD_TOO_LARGE",
                f"Файл слишком большой (max {MAX_CATEGORY_ICON_BYTES // (1024 * 1024)} MB)",
                status=413,
            )
        validate_svg_bytes(data)
        unique_name = f"{secrets.token_hex(10)}.svg"
        destination = folder / unique_name
        destination.write_bytes(data)
        return str(destination.relative_to(UPLOAD_ROOT))

    if ext == ".avif":
        validate_avif_header(file_storage)
        unique_name = f"{secrets.token_hex(10)}.avif"
        destination = folder / unique_name
        file_storage.save(destination)
        return str(destination.relative_to(UPLOAD_ROOT))

    # Raster (PNG/JPEG/WEBP): store optimized thumbnail for public menu.
    return save_category_icon_thumbnail(file_storage, folder, max_px=CATEGORY_ICON_MAX_PX)

def save_loader_image_thumbnail(file_storage, folder: Path, *, max_px: int = LOADER_MAX_PX) -> str:
    """Save a small WEBP thumbnail (max_px) for loader images (static raster only)."""
    try:
        try:
            file_storage.stream.seek(0)
        except Exception:
            pass
        with Image.open(file_storage.stream) as img:
            img.load()
            img = img.convert("RGBA")
            img.thumbnail((max_px, max_px), Image.LANCZOS)
            unique_name = f"{secrets.token_hex(10)}.webp"
            destination = folder / unique_name
            img.save(destination, format="WEBP", quality=80, method=6)
            return str(destination.relative_to(UPLOAD_ROOT))
    except UnidentifiedImageError:
        raise ApiUploadError("UNSUPPORTED_MEDIA_TYPE", "Файл не является корректным изображением", status=415)
    except ApiUploadError:
        raise
    except Exception:
        raise ApiUploadError("UNSUPPORTED_MEDIA_TYPE", "Файл не является корректным изображением", status=415)
    finally:
        try:
            file_storage.stream.seek(0)
        except Exception:
            pass


def save_loader_upload(file_storage, folder: Path, *, field_name: str = "file") -> str:
    if not file_storage or not getattr(file_storage, "filename", None):
        raise ApiUploadError("VALIDATION_ERROR", f"Файл {field_name} обязателен", status=400)

    filename = secure_filename(file_storage.filename)
    if not filename:
        raise ApiUploadError("VALIDATION_ERROR", "Некорректное имя файла", status=400)

    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_LOADER_EXTS:
        raise ApiUploadError(
            "UNSUPPORTED_MEDIA_TYPE",
            "Неподдерживаемый формат файла",
            status=415,
            details={"allowed_exts": sorted(ALLOWED_LOADER_EXTS)},
        )

    mimetype = (getattr(file_storage, "mimetype", "") or "").lower()
    if mimetype and mimetype not in ALLOWED_LOADER_MIMES:
        raise ApiUploadError(
            "UNSUPPORTED_MEDIA_TYPE",
            "Неподдерживаемый MIME тип",
            status=415,
            details={"allowed_mimes": sorted(ALLOWED_LOADER_MIMES)},
        )

    size = get_filestorage_size(file_storage)
    if size is None:
        try:
            file_storage.stream.seek(0)
        except Exception:
            pass
        head = file_storage.stream.read(MAX_LOADER_BYTES + 1) or b""
        try:
            file_storage.stream.seek(0)
        except Exception:
            pass
        size = len(head)
    if size > MAX_LOADER_BYTES:
        raise ApiUploadError(
            "PAYLOAD_TOO_LARGE",
            f"Файл слишком большой (max {MAX_LOADER_BYTES // (1024 * 1024)} MB)",
            status=413,
        )

    folder.mkdir(parents=True, exist_ok=True)

    if ext == ".svg":
        data = file_storage.read() or b""
        if len(data) > MAX_LOADER_BYTES:
            raise ApiUploadError(
                "PAYLOAD_TOO_LARGE",
                f"Файл слишком большой (max {MAX_LOADER_BYTES // (1024 * 1024)} MB)",
                status=413,
            )
        validate_svg_bytes(data)
        unique_name = f"{secrets.token_hex(10)}.svg"
        destination = folder / unique_name
        destination.write_bytes(data)
        return str(destination.relative_to(UPLOAD_ROOT))

    if ext == ".avif":
        validate_avif_header(file_storage)
        unique_name = f"{secrets.token_hex(10)}.avif"
        destination = folder / unique_name
        file_storage.save(destination)
        return str(destination.relative_to(UPLOAD_ROOT))

    if ext == ".gif":
        # Keep GIF as-is to preserve animation.
        try:
            try:
                file_storage.stream.seek(0)
            except Exception:
                pass
            with Image.open(file_storage.stream) as img:
                img.verify()
                if (img.format or "").upper() != "GIF":
                    raise ApiUploadError("UNSUPPORTED_MEDIA_TYPE", "GIF файл некорректен", status=415)
        except ApiUploadError:
            raise
        except Exception:
            raise ApiUploadError("UNSUPPORTED_MEDIA_TYPE", "GIF файл некорректен", status=415)
        finally:
            try:
                file_storage.stream.seek(0)
            except Exception:
                pass

        unique_name = f"{secrets.token_hex(10)}.gif"
        destination = folder / unique_name
        file_storage.save(destination)
        return str(destination.relative_to(UPLOAD_ROOT))

    # Static raster: store optimized thumbnail (WEBP) for public menu.
    return save_loader_image_thumbnail(file_storage, folder, max_px=LOADER_MAX_PX)


def save_font_upload(file_storage, folder: Path, *, field_name: str = "file") -> str:
    if not file_storage or not getattr(file_storage, "filename", None):
        raise ApiUploadError("VALIDATION_ERROR", f"Файл {field_name} обязателен", status=400)

    filename = secure_filename(file_storage.filename)
    if not filename:
        raise ApiUploadError("VALIDATION_ERROR", "Некорректное имя файла", status=400)

    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_FONT_EXTS:
        raise ApiUploadError(
            "UNSUPPORTED_MEDIA_TYPE",
            "Разрешены только WOFF2/WOFF/TTF/OTF",
            status=415,
            details={"allowed_exts": sorted(ALLOWED_FONT_EXTS)},
        )

    mimetype = (getattr(file_storage, "mimetype", "") or "").lower()
    if mimetype and mimetype not in ALLOWED_FONT_MIMES:
        raise ApiUploadError(
            "UNSUPPORTED_MEDIA_TYPE",
            "Неподдерживаемый MIME тип",
            status=415,
            details={"allowed_mimes": sorted(ALLOWED_FONT_MIMES)},
        )

    size = get_filestorage_size(file_storage)
    if size is None:
        try:
            file_storage.stream.seek(0)
        except Exception:
            pass
        head = file_storage.stream.read(MAX_FONT_BYTES + 1) or b""
        try:
            file_storage.stream.seek(0)
        except Exception:
            pass
        size = len(head)
    if size > MAX_FONT_BYTES:
        raise ApiUploadError(
            "PAYLOAD_TOO_LARGE",
            f"Файл слишком большой (max {MAX_FONT_BYTES // (1024 * 1024)} MB)",
            status=413,
        )

    folder.mkdir(parents=True, exist_ok=True)
    unique_name = f"{secrets.token_hex(10)}{ext}"
    destination = folder / unique_name
    file_storage.save(destination)
    return str(destination.relative_to(UPLOAD_ROOT))


def normalize_restaurant_menu_font(raw: str | None, *, restaurant_id: int) -> str:
    value = (raw or "").strip()
    if not value:
        return "serif"

    presets = {"serif", "sans", "system"}
    if value in presets:
        return value

    try:
        p = Path(value)
    except Exception:
        raise ApiUploadError("VALIDATION_ERROR", "Некорректный путь к файлу", status=400)

    if p.is_absolute() or ".." in p.parts:
        raise ApiUploadError("VALIDATION_ERROR", "Некорректный путь к файлу", status=400)

    normalized = p.as_posix().lstrip("/")
    expected_prefix = f"fonts/r{restaurant_id}/"
    if not normalized.startswith(expected_prefix):
        raise ApiUploadError("VALIDATION_ERROR", "Некорректный путь к файлу", status=400)

    full = UPLOAD_ROOT / normalized
    if not full.is_file():
        raise ApiUploadError("VALIDATION_ERROR", "Файл не найден", status=400)
    if full.suffix.lower() not in ALLOWED_FONT_EXTS:
        raise ApiUploadError("VALIDATION_ERROR", "Неподдерживаемый формат файла", status=400)

    return normalized


def normalize_category_image_path(raw: str | None, *, restaurant_id: int) -> str | None:
    value = (raw or "").strip()
    if not value:
        return None

    try:
        p = Path(value)
    except Exception:
        raise ApiUploadError("VALIDATION_ERROR", "Некорректный путь к файлу", status=400)

    if p.is_absolute() or ".." in p.parts:
        raise ApiUploadError("VALIDATION_ERROR", "Некорректный путь к файлу", status=400)

    normalized = p.as_posix().lstrip("/")
    expected_prefix = f"categories/r{restaurant_id}/"
    if not normalized.startswith(expected_prefix):
        raise ApiUploadError("VALIDATION_ERROR", "Некорректный путь к файлу", status=400)

    full = UPLOAD_ROOT / normalized
    if not full.is_file():
        raise ApiUploadError("VALIDATION_ERROR", "Файл не найден", status=400)
    if full.suffix.lower() not in ALLOWED_CATEGORY_ICON_EXTS:
        raise ApiUploadError("VALIDATION_ERROR", "Неподдерживаемый формат файла", status=400)

    return normalized


def normalize_restaurant_loader_path(raw: str | None, *, restaurant_id: int) -> str | None:
    value = (raw or "").strip()
    if not value:
        return None

    try:
        p = Path(value)
    except Exception:
        raise ApiUploadError("VALIDATION_ERROR", "Некорректный путь к файлу", status=400)

    if p.is_absolute() or ".." in p.parts:
        raise ApiUploadError("VALIDATION_ERROR", "Некорректный путь к файлу", status=400)

    normalized = p.as_posix().lstrip("/")
    expected_prefix = f"loaders/r{restaurant_id}/"
    if not normalized.startswith(expected_prefix):
        raise ApiUploadError("VALIDATION_ERROR", "Некорректный путь к файлу", status=400)

    full = UPLOAD_ROOT / normalized
    if not full.is_file():
        raise ApiUploadError("VALIDATION_ERROR", "Файл не найден", status=400)
    if full.suffix.lower() not in ALLOWED_LOADER_EXTS:
        raise ApiUploadError("VALIDATION_ERROR", "Неподдерживаемый формат файла", status=400)

    return normalized


def is_image_filename(name: str | None) -> bool:
    if not name:
        return False
    return Path(name).suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif"}

def is_admin_user(user: User | None) -> bool:
    if not user:
        return False
    email = (getattr(user, "email", "") or "").lower()
    if email in ADMIN_EMAILS:
        if getattr(user, "role", None) not in {"admin", "superadmin"}:
            user.role = "admin"
            db.session.commit()
        return True
    # Allow explicit superadmin fallback (e.g., manual override)
    return getattr(user, "role", None) == "superadmin"


def is_manager_only(user: User) -> bool:
    if is_admin_user(user):
        return False
    owns = Restaurant.query.filter_by(user_id=user.id).count()
    if owns > 0:
        return False
    manager_links = RestaurantUser.query.filter_by(user_id=user.id).count()
    return manager_links > 0


def has_restaurant_access(restaurant: Restaurant | None) -> bool:
    if not restaurant:
        return False
    if current_user.is_authenticated and is_admin_user(current_user):
        return True
    if restaurant.owner == current_user:
        return True
    # Managers linked to restaurant
    if current_user.is_authenticated:
        return (
            RestaurantUser.query.filter_by(restaurant_id=restaurant.id, user_id=current_user.id).first()
            is not None
        )
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


def is_strong_password(password: str) -> bool:
    if not password or len(password) < 8:
        return False
    has_alpha = any(ch.isalpha() for ch in password)
    has_digit = any(ch.isdigit() for ch in password)
    symbol_positions = [idx for idx, ch in enumerate(password) if not ch.isalnum()]
    has_symbols = len(symbol_positions) >= 2 and any(
        (symbol_positions[i + 1] - symbol_positions[i]) > 1 for i in range(len(symbol_positions) - 1)
    )
    return has_alpha and has_digit and has_symbols


def contains_restaurant_hint(password: str, restaurant: Restaurant | None) -> bool:
    if not restaurant or not password:
        return False
    norm_pwd = "".join(ch.lower() for ch in password if ch.isalnum())
    if not norm_pwd:
        return False
    name_candidates = [restaurant.name, restaurant.slug]
    for trans in (restaurant.name_translations or {}).values():
        name_candidates.append(trans)
    for candidate in name_candidates:
        if not candidate:
            continue
        norm_candidate = "".join(ch.lower() for ch in candidate if ch.isalnum())
        if norm_candidate and norm_candidate in norm_pwd:
            return True
    return False


def translate_role(role: str | None, lang: str) -> str:
    if not role:
        return ""
    key = ROLE_TRANSLATION_KEYS.get(role, role)
    label = translate_ui(key, lang)
    if label == key:
        return role.capitalize()
    return label


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


def get_user_restaurants(user: User) -> list[Restaurant]:
    owned = Restaurant.query.filter_by(user_id=user.id).all()
    managed = (
        Restaurant.query.join(RestaurantUser, Restaurant.id == RestaurantUser.restaurant_id)
        .filter(RestaurantUser.user_id == user.id)
        .all()
    )
    rest_map: dict[int, Restaurant] = {r.id: r for r in owned}
    for r in managed:
        rest_map.setdefault(r.id, r)
    return list(rest_map.values())


def build_restaurant_collections(restaurants: list[Restaurant]) -> tuple[dict[int, list[Category]], dict[int, list[DiningTable]]]:
    categories_by_rest: dict[int, list[Category]] = {}
    tables_by_rest: dict[int, list[DiningTable]] = {}
    restaurant_ids = [r.id for r in restaurants]
    if not restaurant_ids:
        return categories_by_rest, tables_by_rest
    categories = (
        Category.query.filter(Category.restaurant_id.in_(restaurant_ids))
        .order_by(Category.restaurant_id, Category.sort_order, Category.name)
        .all()
    )
    for category in categories:
        categories_by_rest.setdefault(category.restaurant_id, []).append(category)
    tables = (
        DiningTable.query.filter(DiningTable.restaurant_id.in_(restaurant_ids))
        .order_by(DiningTable.restaurant_id, DiningTable.number)
        .all()
    )
    for table in tables:
        tables_by_rest.setdefault(table.restaurant_id, []).append(table)
    return categories_by_rest, tables_by_rest


def build_restaurant_managers(restaurants: list[Restaurant]) -> dict[int, list[User]]:
    managers_by_rest: dict[int, list[dict]] = {}
    restaurant_ids = [r.id for r in restaurants]
    if not restaurant_ids:
        return managers_by_rest
    rows = (
        db.session.query(RestaurantUser, User)
        .join(User, User.id == RestaurantUser.user_id)
        .filter(RestaurantUser.restaurant_id.in_(restaurant_ids))
        .all()
    )
    for link, user in rows:
        managers_by_rest.setdefault(link.restaurant_id, []).append({"user": user, "link_id": link.id})
    return managers_by_rest


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


@app.before_request
def enforce_blocked_users():
    """Prevent blocked users from using the app after logout/login."""
    if not current_user.is_authenticated:
        return None
    if getattr(current_user, "is_blocked", False):
        endpoint = (request.endpoint or "").split(".")[0]
        if endpoint not in {"login", "logout"} and not endpoint.startswith("static"):
            logout_user()
            if request.path.startswith("/api/"):
                return api_error("AUTH_BLOCKED", "Пользователь заблокирован", status=403)
            flash_t("user_blocked_login", "danger")
            return redirect(url_for("login"))
    return None


@login_manager.unauthorized_handler
def unauthorized_handler():
    if request.path.startswith("/api/"):
        return api_error("AUTH_UNAUTHORIZED", "Не авторизован", status=401)
    return redirect(url_for("login"))


def api_success(data=None, meta=None, status: int = 200):
    payload = {"data": data}
    if meta is not None:
        payload["meta"] = meta
    return payload, status


def api_error(code: str, message: str, status: int = 400, details=None):
    err = {"code": code, "message": message}
    if details is not None:
        err["details"] = details
    return {"error": err}, status


def is_api_request() -> bool:
    return request.path.startswith("/api/")


@app.errorhandler(HTTPException)
def handle_http_exception(err: HTTPException):
    if not is_api_request():
        return err

    status = int(getattr(err, "code", 500) or 500)
    default = {
        400: ("BAD_REQUEST", "Некорректный запрос"),
        401: ("AUTH_UNAUTHORIZED", "Не авторизован"),
        403: ("FORBIDDEN", "Доступ запрещён"),
        404: ("NOT_FOUND", "Не найдено"),
        405: ("METHOD_NOT_ALLOWED", "Метод не поддерживается"),
        409: ("CONFLICT", "Конфликт данных"),
        413: ("PAYLOAD_TOO_LARGE", "Слишком большой файл"),
        415: ("UNSUPPORTED_MEDIA_TYPE", "Неподдерживаемый тип данных"),
    }.get(status, ("HTTP_ERROR", "Ошибка"))

    code, fallback_message = default
    description = getattr(err, "description", None)
    message = description if isinstance(description, str) and description else fallback_message
    return api_error(code, message, status=status)


@app.errorhandler(Exception)
def handle_unhandled_exception(err: Exception):
    if not is_api_request():
        raise err
    app.logger.exception("Unhandled API error: %s", err)
    return api_error("INTERNAL_ERROR", "Внутренняя ошибка сервера", status=500)


def api_user_dict(u: User) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "username": u.username,
        "role": u.role,
        "is_blocked": bool(getattr(u, "is_blocked", False)),
    }


def api_restaurant_dict(r: Restaurant) -> dict:
    return {
        "id": r.id,
        "name": r.name,
        "description": r.description,
        "slug": r.slug,
        "logo_url": r.logo_url(),
        "phone": getattr(r, "phone", None),
        "whatsapp": getattr(r, "whatsapp", None),
        "instagram": getattr(r, "instagram", None),
        "facebook": getattr(r, "facebook", None),
        "theme": r.theme,
        "theme_id": getattr(r, "theme_id", None),
        "theme_overrides_json": getattr(r, "theme_overrides_json", None) or {},
        "hero_preset_id": getattr(r, "hero_preset_id", None),
        "hero_overrides_json": getattr(r, "hero_overrides_json", None) or {},
        "hero": restaurant_effective_hero(r),
        "menu_card_preset_id": getattr(r, "menu_card_preset_id", None),
        "menu_card_overrides_json": getattr(r, "menu_card_overrides_json", None) or {},
        "menu_card_remove_bg_on_upload": bool(getattr(r, "menu_card_remove_bg_on_upload", False)),
        "menu_card": restaurant_effective_menu_card(r),
        "menu_font": r.menu_font,
        "menu_font_size": getattr(r, "menu_font_size", None),
        "menu_font_brand": getattr(r, "menu_font_brand", None),
        "menu_font_brand_size": getattr(r, "menu_font_brand_size", None),
        "menu_font_category": getattr(r, "menu_font_category", None),
        "menu_font_category_size": getattr(r, "menu_font_category_size", None),
        "menu_font_item": getattr(r, "menu_font_item", None),
        "menu_font_item_size": getattr(r, "menu_font_item_size", None),
        "loading_image_path": getattr(r, "loading_image_path", None),
        "loading_image_url": r.loading_image_url() if hasattr(r, "loading_image_url") else None,
        "loading_style": getattr(r, "loading_style", None) or "spinner",
    }


def api_category_dict(c: Category) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "icon_name": c.icon_name,
        "image_path": getattr(c, "image_path", None),
        "image_url": c.image_url() if hasattr(c, "image_url") else None,
        "sort_order": c.sort_order,
        "restaurant_id": c.restaurant_id,
    }


def api_dish_dict(d: Dish) -> dict:
    return {
        "id": d.id,
        "name": d.name,
        "description": d.description,
        "price": float(d.price),
        "currency": d.currency,
        "available": bool(d.available),
        "is_spicy": bool(d.is_spicy),
        "is_vegan": bool(d.is_vegan),
        "image_url": d.image_url(),
        "image_srcset": d.image_srcset() if hasattr(d, "image_srcset") else None,
        "image_remove_bg_status": getattr(d, "image_remove_bg_status", None),
        "use_processed_image": bool(getattr(d, "use_processed_image", False)),
        "category_id": d.category_id,
    }


def api_table_dict(t: DiningTable) -> dict:
    return {
        "id": t.id,
        "number": t.number,
        "is_occupied": bool(t.is_occupied),
        "restaurant_id": t.restaurant_id,
    }


def sanitize_theme_config(raw: dict | None) -> dict:
    cfg = raw if isinstance(raw, dict) else {}
    safe: dict = {}

    vars_raw = cfg.get("vars")
    if isinstance(vars_raw, dict):
        safe_vars = {}
        for k, v in vars_raw.items():
            if not isinstance(k, str) or not k.startswith("--pm-"):
                continue
            if not isinstance(v, str):
                continue
            if len(v) > 120:
                continue
            safe_vars[k] = v
        safe["vars"] = safe_vars

    for key in ("category_layout", "transition", "card_style"):
        v = cfg.get(key)
        if isinstance(v, str) and len(v) <= 40:
            safe[key] = v

    return safe


def restaurant_effective_theme(restaurant: Restaurant) -> dict:
    theme_obj = None
    if getattr(restaurant, "theme_id", None):
        try:
            theme_obj = db.session.get(Theme, int(restaurant.theme_id))
        except Exception:
            theme_obj = None

    if not theme_obj:
        theme_obj = Theme.query.filter_by(preset_key=DEFAULT_THEME_PRESET).first()

    base_cfg = sanitize_theme_config(getattr(theme_obj, "config_json", None) if theme_obj else None)
    overrides_cfg = sanitize_theme_config(getattr(restaurant, "theme_overrides_json", None))
    merged = deep_merge_dict(base_cfg, overrides_cfg)

    return {
        "id": getattr(theme_obj, "id", None),
        "preset_key": getattr(theme_obj, "preset_key", DEFAULT_THEME_PRESET) if theme_obj else DEFAULT_THEME_PRESET,
        "name": getattr(theme_obj, "name", DEFAULT_THEME_PRESET) if theme_obj else DEFAULT_THEME_PRESET,
        "vars": merged.get("vars") or {},
        "category_layout": merged.get("category_layout") or "pills",
        "transition": merged.get("transition") or "slide",
        "card_style": merged.get("card_style") or "glass",
    }


ALLOWED_HEADER_EFFECTS = {"glowGradient", "minimal", "sunset", "glass"}


def _is_hex_color(value: str) -> bool:
    if not isinstance(value, str):
        return False
    v = value.strip()
    if not v.startswith("#"):
        return False
    if len(v) not in (7, 9):
        return False
    for ch in v[1:]:
        if ch not in "0123456789abcdefABCDEF":
            return False
    return True


def sanitize_header_style(raw: dict | None, strict: bool = False) -> tuple[dict, dict]:
    cfg = raw if isinstance(raw, dict) else {}
    safe: dict = {}
    errors: dict = {}

    def add_error(key: str, message: str) -> None:
        if strict:
            errors[key] = message

    if "headerColor" in cfg:
        v = cfg.get("headerColor")
        if isinstance(v, str) and _is_hex_color(v):
            safe["headerColor"] = v.strip()
        else:
            add_error("headerColor", "Некорректный цвет (ожидается #RRGGBB или #RRGGBBAA)")

    if "accentColor" in cfg:
        v = cfg.get("accentColor")
        if isinstance(v, str) and _is_hex_color(v):
            safe["accentColor"] = v.strip()
        else:
            add_error("accentColor", "Некорректный цвет (ожидается #RRGGBB или #RRGGBBAA)")

    if "effect" in cfg:
        v = cfg.get("effect")
        if isinstance(v, str) and v in ALLOWED_HEADER_EFFECTS:
            safe["effect"] = v
        else:
            add_error("effect", f"Некорректный effect (allowed: {sorted(ALLOWED_HEADER_EFFECTS)})")

    def parse_01(key: str) -> None:
        if key not in cfg:
            return
        v = cfg.get(key)
        try:
            num = float(v)
        except Exception:
            add_error(key, "Ожидается число 0..1")
            return
        if num < 0 or num > 1:
            add_error(key, "Ожидается число 0..1")
            return
        safe[key] = round(num, 4)

    parse_01("glow")
    parse_01("fade")
    parse_01("shadow")

    if "radius" in cfg:
        v = cfg.get("radius")
        try:
            num = int(float(v))
        except Exception:
            add_error("radius", "Ожидается число 0..40")
        else:
            if num < 0 or num > 40:
                add_error("radius", "Ожидается число 0..40")
            else:
                safe["radius"] = num

    return safe, errors


def restaurant_effective_header_style(restaurant: Restaurant) -> dict:
    theme = restaurant_effective_theme(restaurant)
    vars_cfg = theme.get("vars") or {}
    base_color = vars_cfg.get("--pm-category") or vars_cfg.get("--pm-accent") or "#F39A1E"
    base = {
        "headerColor": base_color if isinstance(base_color, str) else "#F39A1E",
        "effect": "glowGradient",
        "glow": 0.55,
        "fade": 0.75,
        "radius": 24,
        "shadow": 0.35,
        "accentColor": "#FFFFFF33",
    }
    overrides, _ = sanitize_header_style(getattr(restaurant, "header_style_json", None), strict=False)
    base.update(overrides)
    return base


def category_effective_header_style(restaurant: Restaurant, category: Category) -> tuple[dict, dict]:
    base = restaurant_effective_header_style(restaurant)
    overrides, _ = sanitize_header_style(getattr(category, "header_style_json", None), strict=False)
    merged = dict(base)
    merged.update(overrides)
    return merged, overrides


ALLOWED_HERO_BACKGROUND_MODES = {"solid", "gradient"}
ALLOWED_HERO_BADGE_SHAPES = {"circle", "rounded", "squircle"}


def sanitize_hero_config(raw: dict | None, strict: bool = False) -> tuple[dict, dict]:
    cfg = raw if isinstance(raw, dict) else {}
    safe: dict = {}
    errors: dict = {}

    def add_error(key: str, message: str) -> None:
        if strict:
            errors[key] = message

    if "backgroundMode" in cfg:
        v = cfg.get("backgroundMode")
        if isinstance(v, str) and v in ALLOWED_HERO_BACKGROUND_MODES:
            safe["backgroundMode"] = v
        else:
            add_error("backgroundMode", f"Некорректный backgroundMode (allowed: {sorted(ALLOWED_HERO_BACKGROUND_MODES)})")

    if "bgSolid" in cfg:
        v = cfg.get("bgSolid")
        if isinstance(v, str) and _is_hex_color(v):
            safe["bgSolid"] = v.strip()
        else:
            add_error("bgSolid", "Некорректный bgSolid (ожидается #RRGGBB или #RRGGBBAA)")

    if "bgGradient" in cfg:
        v = cfg.get("bgGradient")
        if isinstance(v, (list, tuple)) and len(v) == 2 and all(isinstance(x, str) and _is_hex_color(x) for x in v):
            safe["bgGradient"] = [v[0].strip(), v[1].strip()]
        else:
            add_error("bgGradient", "Некорректный bgGradient (ожидается [\"#RRGGBB\", \"#RRGGBB\"])")

    if "accentColor" in cfg:
        v = cfg.get("accentColor")
        if isinstance(v, str) and _is_hex_color(v):
            safe["accentColor"] = v.strip()
        else:
            add_error("accentColor", "Некорректный accentColor (ожидается #RRGGBB или #RRGGBBAA)")

    if "badgeShape" in cfg:
        v = cfg.get("badgeShape")
        if isinstance(v, str) and v in ALLOWED_HERO_BADGE_SHAPES:
            safe["badgeShape"] = v
        else:
            add_error("badgeShape", f"Некорректный badgeShape (allowed: {sorted(ALLOWED_HERO_BADGE_SHAPES)})")

    def parse_01(key: str) -> None:
        if key not in cfg:
            return
        v = cfg.get(key)
        try:
            num = float(v)
        except Exception:
            add_error(key, "Ожидается число 0..1")
            return
        if num < 0 or num > 1:
            add_error(key, "Ожидается число 0..1")
            return
        safe[key] = round(num, 4)

    def parse_int_range(key: str, min_value: int, max_value: int) -> None:
        if key not in cfg:
            return
        v = cfg.get(key)
        try:
            num = int(float(v))
        except Exception:
            add_error(key, f"Ожидается число {min_value}..{max_value}")
            return
        if num < min_value or num > max_value:
            add_error(key, f"Ожидается число {min_value}..{max_value}")
            return
        safe[key] = num

    parse_int_range("badgeBlur", 0, 24)
    parse_01("badgeOpacity")
    parse_01("badgeBorderOpacity")
    parse_int_range("logoSize", 40, 120)
    parse_01("glowStrength")
    parse_int_range("glowRadius", 0, 60)
    parse_01("fadeStrength")
    parse_int_range("paddingTop", 0, 40)
    parse_int_range("paddingBottom", 0, 48)
    parse_int_range("radius", 0, 40)

    return safe, errors


ALLOWED_MENU_CARD_LAYOUTS = {"grid", "compact"}
ALLOWED_MENU_CARD_RATIOS = {"1:1", "4:3", "16:9"}
ALLOWED_MENU_CARD_IMAGE_FITS = {"cover", "contain"}
ALLOWED_MENU_CARD_IMAGE_BG_MODES = {"solid", "gradient", "surface"}
ALLOWED_MENU_CARD_VISUAL_PRESETS = {"minimal", "soft", "bold"}
ALLOWED_MENU_CARD_CORNER_STYLES = {"none", "lines", "brackets", "dots"}
ALLOWED_MENU_CARD_FRAME_BGS = {"imageBg", "surface", "none"}


def sanitize_menu_card_config(raw: dict | None, strict: bool = False) -> tuple[dict, dict]:
    cfg = raw if isinstance(raw, dict) else {}
    safe: dict = {}
    errors: dict = {}

    def add_error(key: str, message: str) -> None:
        if strict:
            errors[key] = message

    if "preset" in cfg:
        v = cfg.get("preset")
        if isinstance(v, str) and len(v) <= 80:
            safe["preset"] = v.strip()
        else:
            add_error("preset", "Некорректный preset")

    if "layout" in cfg:
        v = cfg.get("layout")
        if isinstance(v, str) and v in ALLOWED_MENU_CARD_LAYOUTS:
            safe["layout"] = v
        else:
            add_error("layout", f"Некорректный layout (allowed: {sorted(ALLOWED_MENU_CARD_LAYOUTS)})")

    if "cardPreset" in cfg:
        v = cfg.get("cardPreset")
        if isinstance(v, str) and v in ALLOWED_MENU_CARD_VISUAL_PRESETS:
            safe["cardPreset"] = v
        else:
            add_error("cardPreset", f"Некорректный cardPreset (allowed: {sorted(ALLOWED_MENU_CARD_VISUAL_PRESETS)})")

    def parse_int(key: str, min_value: int, max_value: int) -> None:
        if key not in cfg:
            return
        v = cfg.get(key)
        try:
            num = int(float(v))
        except Exception:
            add_error(key, f"Ожидается число {min_value}..{max_value}")
            return
        if num < min_value or num > max_value:
            add_error(key, f"Ожидается число {min_value}..{max_value}")
            return
        safe[key] = num

    def parse_01(key: str) -> None:
        if key not in cfg:
            return
        v = cfg.get(key)
        try:
            num = float(v)
        except Exception:
            add_error(key, "Ожидается число 0..1")
            return
        if num < 0 or num > 1:
            add_error(key, "Ожидается число 0..1")
            return
        safe[key] = round(num, 4)

    parse_int("cardRadius", 0, 28)
    parse_01("cardBorderOpacity")
    parse_01("cardShadow")
    parse_int("imagePadding", 0, 18)

    if "imageRatio" in cfg:
        v = cfg.get("imageRatio")
        if isinstance(v, str) and v in ALLOWED_MENU_CARD_RATIOS:
            safe["imageRatio"] = v
        else:
            add_error("imageRatio", f"Некорректный imageRatio (allowed: {sorted(ALLOWED_MENU_CARD_RATIOS)})")

    if "imageFit" in cfg:
        v = cfg.get("imageFit")
        if isinstance(v, str) and v in ALLOWED_MENU_CARD_IMAGE_FITS:
            safe["imageFit"] = v
        else:
            add_error("imageFit", f"Некорректный imageFit (allowed: {sorted(ALLOWED_MENU_CARD_IMAGE_FITS)})")

    if "imageBgMode" in cfg:
        v = cfg.get("imageBgMode")
        if isinstance(v, str) and v in ALLOWED_MENU_CARD_IMAGE_BG_MODES:
            safe["imageBgMode"] = v
        else:
            add_error("imageBgMode", f"Некорректный imageBgMode (allowed: {sorted(ALLOWED_MENU_CARD_IMAGE_BG_MODES)})")

    if "imageBgColors" in cfg:
        v = cfg.get("imageBgColors")
        if isinstance(v, (list, tuple)) and len(v) == 2 and all(isinstance(x, str) and _is_hex_color(x) for x in v):
            safe["imageBgColors"] = [v[0].strip(), v[1].strip()]
        else:
            add_error("imageBgColors", "Некорректный imageBgColors (ожидается [\"#RRGGBB\", \"#RRGGBB\"])")

    if "cornerStyle" in cfg:
        v = cfg.get("cornerStyle")
        if isinstance(v, str) and v in ALLOWED_MENU_CARD_CORNER_STYLES:
            safe["cornerStyle"] = v
        else:
            add_error("cornerStyle", f"Некорректный cornerStyle (allowed: {sorted(ALLOWED_MENU_CARD_CORNER_STYLES)})")

    if "cornerColor" in cfg:
        v = cfg.get("cornerColor")
        if isinstance(v, str) and (v == "accent" or _is_hex_color(v)):
            safe["cornerColor"] = v.strip()
        else:
            add_error("cornerColor", "Некорректный cornerColor (ожидается \"accent\" или #RRGGBB/#RRGGBBAA)")

    if "frame" in cfg:
        v = cfg.get("frame")
        if isinstance(v, dict):
            frame_safe: dict = {}
            bg = v.get("bg")
            if bg is not None:
                if isinstance(bg, str) and bg in ALLOWED_MENU_CARD_FRAME_BGS:
                    frame_safe["bg"] = bg
                else:
                    add_error("frame.bg", f"Некорректный frame.bg (allowed: {sorted(ALLOWED_MENU_CARD_FRAME_BGS)})")

            border = v.get("border")
            if border is not None:
                try:
                    num = float(border)
                except Exception:
                    add_error("frame.border", "Ожидается число 0..1")
                else:
                    if num < 0 or num > 1:
                        add_error("frame.border", "Ожидается число 0..1")
                    else:
                        frame_safe["border"] = round(num, 4)

            if frame_safe:
                safe["frame"] = frame_safe
        else:
            add_error("frame", "Некорректный frame (ожидается объект)")

    return safe, errors


def restaurant_effective_menu_card(restaurant: Restaurant) -> dict:
    preset = None
    try:
        if getattr(restaurant, "menu_card_preset_id", None):
            preset = db.session.get(MenuCardPreset, int(restaurant.menu_card_preset_id))
    except Exception:
        preset = None

    if not preset:
        preset = MenuCardPreset.query.filter_by(key=DEFAULT_MENU_CARD_PRESET_KEY).first()

    base_cfg = sanitize_menu_card_config(getattr(preset, "config_json", None) if preset else None, strict=False)[0]
    overrides_cfg = sanitize_menu_card_config(getattr(restaurant, "menu_card_overrides_json", None), strict=False)[0]
    merged = deep_merge_dict(base_cfg, overrides_cfg)

    return {
        "preset_id": getattr(preset, "id", None),
        "preset_key": getattr(preset, "key", DEFAULT_MENU_CARD_PRESET_KEY) if preset else DEFAULT_MENU_CARD_PRESET_KEY,
        "name": getattr(preset, "name", DEFAULT_MENU_CARD_PRESET_KEY) if preset else DEFAULT_MENU_CARD_PRESET_KEY,
        "config": merged,
        "overrides": overrides_cfg,
        "remove_bg_on_upload": bool(getattr(restaurant, "menu_card_remove_bg_on_upload", False)),
    }


def api_hero_preset_dict(p: HeroPreset) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "key": p.key,
        "is_builtin": bool(p.is_builtin),
        "config_json": sanitize_hero_config(getattr(p, "config_json", None), strict=False)[0],
    }


def api_menu_card_preset_dict(p: MenuCardPreset) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "key": p.key,
        "is_builtin": bool(getattr(p, "is_builtin", False)),
        "config_json": sanitize_menu_card_config(getattr(p, "config_json", None), strict=False)[0],
    }


def restaurant_effective_hero(restaurant: Restaurant) -> dict:
    preset = None
    try:
        if getattr(restaurant, "hero_preset_id", None):
            preset = db.session.get(HeroPreset, int(restaurant.hero_preset_id))
    except Exception:
        preset = None

    if not preset:
        preset = HeroPreset.query.filter_by(key=DEFAULT_HERO_PRESET_KEY).first()

    base_cfg = sanitize_hero_config(getattr(preset, "config_json", None) if preset else None, strict=False)[0]
    overrides_cfg = sanitize_hero_config(getattr(restaurant, "hero_overrides_json", None), strict=False)[0]
    merged = dict(base_cfg)
    merged.update(overrides_cfg)

    return {
        "preset_id": getattr(preset, "id", None),
        "preset_key": getattr(preset, "key", DEFAULT_HERO_PRESET_KEY) if preset else DEFAULT_HERO_PRESET_KEY,
        "name": getattr(preset, "name", DEFAULT_HERO_PRESET_KEY) if preset else DEFAULT_HERO_PRESET_KEY,
        "config": merged,
    }


def api_parse_int(v, default=None):
    try:
        return int(v)
    except Exception:
        return default


def api_parse_bool(v, default=False):
    if v is None:
        return default
    if isinstance(v, bool):
        return v
    s = str(v).strip().lower()
    return s in ("1", "true", "yes", "on")


def api_page_args():
    page = max(1, api_parse_int(request.args.get("page"), 1) or 1)
    page_size = api_parse_int(request.args.get("page_size"), 20) or 20
    page_size = min(max(page_size, 1), 100)
    return page, page_size


@app.route("/api/auth/me")
def api_auth_me():
    if not current_user.is_authenticated:
        return api_error("AUTH_UNAUTHORIZED", "Не авторизован", status=401)
    return api_success({"user": api_user_dict(current_user)})


@app.route("/api/auth/login", methods=["POST"])
def api_auth_login():
    data = request.get_json(silent=True) or {}
    identifier = (data.get("identifier") or "").strip().lower()
    password = data.get("password") or ""
    if not identifier or not password:
        return api_error("VALIDATION_ERROR", "Нужно указать identifier и password", status=400)

    login_with_username = "@" not in identifier
    user = (
        User.query.filter_by(username=identifier).first()
        if login_with_username
        else User.query.filter_by(email=identifier).first()
    )

    if not user or not user.check_password(password):
        return api_error("AUTH_BAD_CREDENTIALS", "Неверный логин или пароль", status=401)
    if getattr(user, "is_blocked", False):
        return api_error("AUTH_BLOCKED", "Пользователь заблокирован", status=403)

    if not is_admin_user(user):
        desired_role = "manager" if login_with_username else "owner"
        if user.role != desired_role:
            user.role = desired_role
            db.session.commit()

    login_user(user)
    return api_success({"user": api_user_dict(user)})


@app.route("/api/auth/logout", methods=["POST"])
@login_required
def api_auth_logout():
    logout_user()
    return api_success({"ok": True})


# Backward-compatible aliases (old paths)
@app.route("/api/me")
def api_me():
    return api_auth_me()


@app.route("/api/login", methods=["POST"])
def api_login():
    return api_auth_login()


@app.route("/api/logout", methods=["POST"])
@login_required
def api_logout():
    return api_auth_logout()


@app.route("/api/admin/restaurants")
@login_required
def api_admin_restaurants_list():
    q = (request.args.get("q") or "").strip()
    page, page_size = api_page_args()

    if is_admin_user(current_user):
        query = Restaurant.query
    else:
        allowed = get_user_restaurants(current_user)
        allowed_ids = [r.id for r in allowed]
        if not allowed_ids:
            return api_success({"items": [], "total": 0, "page": page, "page_size": page_size})
        query = Restaurant.query.filter(Restaurant.id.in_(allowed_ids))

    if q:
        like = f"%{q}%"
        query = query.filter(or_(Restaurant.name.ilike(like), Restaurant.slug.ilike(like)))

    total = query.count()
    items = (
        query.order_by(Restaurant.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return api_success({"items": [api_restaurant_dict(r) for r in items], "total": total, "page": page, "page_size": page_size})


@app.route("/api/admin/restaurants", methods=["POST"])
@login_required
def api_admin_restaurants_create():
    if is_manager_only(current_user) and not is_admin_user(current_user):
        return api_error("FORBIDDEN", "Недостаточно прав для создания ресторана", status=403)

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip() or None
    slug_raw = (data.get("slug") or "").strip()

    theme = (data.get("theme") or "classic").strip()
    menu_font_raw = (data.get("menu_font") or "serif").strip()
    menu_font_size = api_parse_int(data.get("menu_font_size")) or 16
    if menu_font_size < 12:
        menu_font_size = 12
    if menu_font_size > 26:
        menu_font_size = 26

    phone = (data.get("phone") or "").strip() or None
    whatsapp = (data.get("whatsapp") or "").strip() or None
    instagram = (data.get("instagram") or "").strip() or None
    facebook = (data.get("facebook") or "").strip() or None
    loading_style = (data.get("loading_style") or "spinner").strip() or "spinner"
    if loading_style not in ALLOWED_LOADER_STYLES:
        loading_style = "spinner"

    if not name:
        return api_error("VALIDATION_ERROR", "Поле name обязательно", status=400)

    slug_value = unique_slug(slug_raw or name)
    try:
        menu_font = normalize_restaurant_menu_font(menu_font_raw, restaurant_id=0)
    except ApiUploadError:
        menu_font = "serif"

    default_theme = Theme.query.filter_by(preset_key=DEFAULT_THEME_PRESET).first()

    restaurant = Restaurant(
        name=name,
        description=description,
        phone=phone,
        whatsapp=whatsapp,
        instagram=instagram,
        facebook=facebook,
        theme=theme,
        menu_font=menu_font,
        menu_font_size=menu_font_size,
        loading_style=loading_style,
        theme_id=default_theme.id if default_theme else None,
        slug=slug_value,
        owner=current_user,
    )
    db.session.add(restaurant)
    db.session.commit()
    return api_success({"restaurant": api_restaurant_dict(restaurant)}, status=201)


@app.route("/api/admin/restaurants/<int:restaurant_id>")
@login_required
def api_admin_restaurant_get(restaurant_id: int):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or not has_restaurant_access(restaurant):
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)
    return api_success({"restaurant": api_restaurant_dict(restaurant)})


@app.route("/api/admin/restaurants/<int:restaurant_id>", methods=["PATCH"])
@login_required
def api_admin_restaurant_update(restaurant_id: int):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or not has_restaurant_access(restaurant):
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)

    data = request.get_json(silent=True) or {}
    if "name" in data:
        restaurant.name = (data.get("name") or "").strip() or restaurant.name
    if "description" in data:
        restaurant.description = (data.get("description") or "").strip() or None
    if "phone" in data:
        restaurant.phone = (data.get("phone") or "").strip() or None
    if "whatsapp" in data:
        restaurant.whatsapp = (data.get("whatsapp") or "").strip() or None
    if "instagram" in data:
        restaurant.instagram = (data.get("instagram") or "").strip() or None
    if "facebook" in data:
        restaurant.facebook = (data.get("facebook") or "").strip() or None
    if "theme" in data:
        restaurant.theme = (data.get("theme") or "").strip() or restaurant.theme
    if "menu_font" in data:
        try:
            restaurant.menu_font = normalize_restaurant_menu_font(data.get("menu_font"), restaurant_id=restaurant.id)
        except ApiUploadError as e:
            return api_error(e.code, e.message, status=e.status, details=e.details)
    if "menu_font_size" in data:
        size = api_parse_int(data.get("menu_font_size"))
        if size is None:
            return api_error("VALIDATION_ERROR", "Некорректный размер шрифта", status=400)
        if size < 12:
            size = 12
        if size > 26:
            size = 26
        restaurant.menu_font_size = size

    if "menu_font_brand" in data:
        raw = (data.get("menu_font_brand") or "").strip()
        if not raw:
            restaurant.menu_font_brand = None
        else:
            try:
                restaurant.menu_font_brand = normalize_restaurant_menu_font(raw, restaurant_id=restaurant.id)
            except ApiUploadError as e:
                return api_error(e.code, e.message, status=e.status, details=e.details)
    if "menu_font_brand_size" in data:
        size = api_parse_int(data.get("menu_font_brand_size"))
        restaurant.menu_font_brand_size = None if size is None else max(12, min(60, size))

    if "menu_font_category" in data:
        raw = (data.get("menu_font_category") or "").strip()
        if not raw:
            restaurant.menu_font_category = None
        else:
            try:
                restaurant.menu_font_category = normalize_restaurant_menu_font(raw, restaurant_id=restaurant.id)
            except ApiUploadError as e:
                return api_error(e.code, e.message, status=e.status, details=e.details)
    if "menu_font_category_size" in data:
        size = api_parse_int(data.get("menu_font_category_size"))
        restaurant.menu_font_category_size = None if size is None else max(10, min(40, size))

    if "menu_font_item" in data:
        raw = (data.get("menu_font_item") or "").strip()
        if not raw:
            restaurant.menu_font_item = None
        else:
            try:
                restaurant.menu_font_item = normalize_restaurant_menu_font(raw, restaurant_id=restaurant.id)
            except ApiUploadError as e:
                return api_error(e.code, e.message, status=e.status, details=e.details)
    if "menu_font_item_size" in data:
        size = api_parse_int(data.get("menu_font_item_size"))
        restaurant.menu_font_item_size = None if size is None else max(10, min(28, size))

    if "loading_style" in data:
        style = (data.get("loading_style") or "").strip() or "spinner"
        if style not in ALLOWED_LOADER_STYLES:
            return api_error(
                "VALIDATION_ERROR",
                "Некорректный стиль загрузки",
                status=400,
                details={"allowed": sorted(ALLOWED_LOADER_STYLES)},
            )
        restaurant.loading_style = style

    if "loading_image_path" in data:
        raw = (data.get("loading_image_path") or "").strip()
        if not raw:
            restaurant.loading_image_path = None
        else:
            try:
                restaurant.loading_image_path = normalize_restaurant_loader_path(raw, restaurant_id=restaurant.id)
            except ApiUploadError as e:
                return api_error(e.code, e.message, status=e.status, details=e.details)

    db.session.commit()
    return api_success({"restaurant": api_restaurant_dict(restaurant)})


@app.route("/api/admin/restaurants/<int:restaurant_id>/theme", methods=["PUT"])
@login_required
def api_admin_restaurant_theme_update(restaurant_id: int):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or not has_restaurant_access(restaurant):
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)

    data = request.get_json(silent=True) or {}
    theme_id = api_parse_int(data.get("theme_id"))
    overrides = data.get("overrides") if isinstance(data.get("overrides"), dict) else data.get("theme_overrides_json")
    overrides = overrides if isinstance(overrides, dict) else {}

    if not theme_id:
        return api_error("VALIDATION_ERROR", "theme_id обязателен", status=400)

    theme_obj = db.session.get(Theme, int(theme_id))
    if not theme_obj:
        return api_error("NOT_FOUND", "Тема не найдена", status=404)

    restaurant.theme_id = int(theme_id)
    restaurant.theme_overrides_json = sanitize_theme_config(overrides)
    db.session.commit()
    return api_success({"restaurant": api_restaurant_dict(restaurant)})


@app.route("/api/admin/restaurants/<int:restaurant_id>/header-style")
@login_required
def api_admin_restaurant_header_style_get(restaurant_id: int):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or not has_restaurant_access(restaurant):
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)

    effective = restaurant_effective_header_style(restaurant)
    overrides, _ = sanitize_header_style(getattr(restaurant, "header_style_json", None), strict=False)
    return api_success({"header_style": effective, "overrides": overrides})


@app.route("/api/admin/restaurants/<int:restaurant_id>/header-style", methods=["PUT"])
@login_required
def api_admin_restaurant_header_style_put(restaurant_id: int):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or not has_restaurant_access(restaurant):
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)

    payload = request.get_json(silent=True)
    if payload is None:
        raw = (request.get_data() or b"").strip()
        if raw == b"null":
            restaurant.header_style_json = None
            db.session.commit()
            return api_success({"header_style": restaurant_effective_header_style(restaurant), "overrides": {}})
        return api_error("VALIDATION_ERROR", "Некорректный JSON", status=400)

    if not isinstance(payload, dict):
        return api_error("VALIDATION_ERROR", "Ожидается объект JSON или null", status=400)

    safe, errors = sanitize_header_style(payload, strict=True)
    if errors:
        return api_error("VALIDATION_ERROR", "Некорректные значения", status=400, details=errors)

    restaurant.header_style_json = safe or None
    db.session.commit()
    effective = restaurant_effective_header_style(restaurant)
    return api_success({"header_style": effective, "overrides": safe})


@app.route("/api/admin/restaurants/<int:restaurant_id>/hero")
@login_required
def api_admin_restaurant_hero_get(restaurant_id: int):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or not has_restaurant_access(restaurant):
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)
    overrides, _ = sanitize_hero_config(getattr(restaurant, "hero_overrides_json", None), strict=False)
    return api_success({"hero": restaurant_effective_hero(restaurant), "overrides": overrides})


@app.route("/api/admin/restaurants/<int:restaurant_id>/hero", methods=["PUT"])
@login_required
def api_admin_restaurant_hero_put(restaurant_id: int):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or not has_restaurant_access(restaurant):
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)

    data = request.get_json(silent=True) or {}
    preset_id = api_parse_int(data.get("hero_preset_id") or data.get("preset_id"))
    overrides = data.get("hero_overrides_json") if isinstance(data.get("hero_overrides_json"), dict) else data.get("overrides")
    overrides = overrides if isinstance(overrides, dict) else {}

    if not preset_id:
        return api_error("VALIDATION_ERROR", "hero_preset_id обязателен", status=400)

    preset = db.session.get(HeroPreset, int(preset_id))
    if not preset:
        return api_error("NOT_FOUND", "Hero preset не найден", status=404)

    safe_overrides, errors = sanitize_hero_config(overrides, strict=True)
    if errors:
        return api_error("VALIDATION_ERROR", "Некорректные значения", status=400, details=errors)

    restaurant.hero_preset_id = int(preset_id)
    restaurant.hero_overrides_json = safe_overrides or None
    db.session.commit()
    return api_success({"restaurant": api_restaurant_dict(restaurant)})


@app.route("/api/admin/menu-card-presets")
@login_required
def api_admin_menu_card_presets_list():
    items = MenuCardPreset.query.order_by(MenuCardPreset.id.asc()).all()
    return api_success({"items": [api_menu_card_preset_dict(p) for p in items]})


def _normalize_menu_card_preset_key(raw: str) -> str | None:
    key = (raw or "").strip()
    if not key or len(key) > 80:
        return None
    for ch in key:
        if ch.isalnum() or ch in ("_", "-"):
            continue
        return None
    return key


@app.route("/api/admin/menu-card-presets", methods=["POST"])
@login_required
def api_admin_menu_card_presets_create():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    key = _normalize_menu_card_preset_key(data.get("key") or data.get("preset_key") or "")
    raw_cfg = data.get("config_json") if isinstance(data.get("config_json"), dict) else {}

    if not name or not key:
        return api_error("VALIDATION_ERROR", "name и key обязательны", status=400)

    if MenuCardPreset.query.filter_by(key=key).first():
        return api_error("CONFLICT", "key уже существует", status=409)

    safe_cfg, errors = sanitize_menu_card_config(raw_cfg, strict=True)
    if errors:
        return api_error("VALIDATION_ERROR", "Некорректные значения", status=400, details=errors)

    preset = MenuCardPreset(name=name, key=key, is_builtin=False, config_json=safe_cfg)
    db.session.add(preset)
    db.session.commit()
    return api_success({"preset": api_menu_card_preset_dict(preset)}, status=201)


@app.route("/api/admin/menu-card-presets/<int:preset_id>/duplicate", methods=["POST"])
@login_required
def api_admin_menu_card_presets_duplicate(preset_id: int):
    preset = db.session.get(MenuCardPreset, preset_id)
    if not preset:
        return api_error("NOT_FOUND", "Card preset не найден", status=404)

    base_key = _normalize_menu_card_preset_key(preset.key or "") or f"preset_{preset.id}"
    new_key = f"{base_key}_{secrets.token_hex(3)}"
    new_name = f"{preset.name} Copy"

    safe_cfg = sanitize_menu_card_config(getattr(preset, "config_json", None), strict=False)[0]
    clone = MenuCardPreset(name=new_name, key=new_key, is_builtin=False, config_json=safe_cfg)
    db.session.add(clone)
    db.session.commit()
    return api_success({"preset": api_menu_card_preset_dict(clone)}, status=201)


@app.route("/api/admin/menu-card-presets/<int:preset_id>", methods=["PUT"])
@login_required
def api_admin_menu_card_presets_update(preset_id: int):
    preset = db.session.get(MenuCardPreset, preset_id)
    if not preset:
        return api_error("NOT_FOUND", "Card preset не найден", status=404)

    if getattr(preset, "is_builtin", False):
        return api_error("FORBIDDEN", "Нельзя редактировать встроенный preset", status=403)

    data = request.get_json(silent=True) or {}
    if "name" in data:
        preset.name = (data.get("name") or "").strip() or preset.name
    if "config_json" in data:
        raw_cfg = data.get("config_json") if isinstance(data.get("config_json"), dict) else {}
        safe_cfg, errors = sanitize_menu_card_config(raw_cfg, strict=True)
        if errors:
            return api_error("VALIDATION_ERROR", "Некорректные значения", status=400, details=errors)
        preset.config_json = safe_cfg

    db.session.commit()
    return api_success({"preset": api_menu_card_preset_dict(preset)})


@app.route("/api/admin/restaurants/<int:restaurant_id>/menu-cards")
@login_required
def api_admin_restaurant_menu_cards_get(restaurant_id: int):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or not has_restaurant_access(restaurant):
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)

    overrides, _ = sanitize_menu_card_config(getattr(restaurant, "menu_card_overrides_json", None), strict=False)
    return api_success(
        {
            "menu_card": restaurant_effective_menu_card(restaurant),
            "overrides": overrides,
            "menu_card_remove_bg_on_upload": bool(getattr(restaurant, "menu_card_remove_bg_on_upload", False)),
        }
    )


@app.route("/api/admin/restaurants/<int:restaurant_id>/menu-cards", methods=["PUT"])
@login_required
def api_admin_restaurant_menu_cards_put(restaurant_id: int):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or not has_restaurant_access(restaurant):
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)

    data = request.get_json(silent=True) or {}
    preset_id = api_parse_int(data.get("menu_card_preset_id") or data.get("preset_id"))
    overrides = data.get("menu_card_overrides_json") if isinstance(data.get("menu_card_overrides_json"), dict) else data.get("overrides")
    overrides = overrides if isinstance(overrides, dict) else {}
    remove_bg = data.get("remove_bg_on_upload")
    if remove_bg is None:
        remove_bg = data.get("menu_card_remove_bg_on_upload")

    if not preset_id:
        return api_error("VALIDATION_ERROR", "menu_card_preset_id обязателен", status=400)

    preset = db.session.get(MenuCardPreset, int(preset_id))
    if not preset:
        return api_error("NOT_FOUND", "Card preset не найден", status=404)

    safe_overrides, errors = sanitize_menu_card_config(overrides, strict=True)
    if errors:
        return api_error("VALIDATION_ERROR", "Некорректные значения", status=400, details=errors)

    restaurant.menu_card_preset_id = int(preset_id)
    restaurant.menu_card_overrides_json = safe_overrides or None
    if remove_bg is not None:
        restaurant.menu_card_remove_bg_on_upload = api_parse_bool(remove_bg, False)

    db.session.commit()
    return api_success({"restaurant": api_restaurant_dict(restaurant)})


@app.route("/api/admin/themes")
@login_required
def api_admin_themes_list():
    themes = Theme.query.order_by(Theme.id.asc()).all()
    return api_success({"items": [api_theme_dict(t) for t in themes]})


@app.route("/api/admin/themes", methods=["POST"])
@login_required
def api_admin_themes_create():
    if not is_admin_user(current_user):
        return api_error("FORBIDDEN", "Доступ запрещён", status=403)

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    preset_key = (data.get("preset_key") or "").strip()
    config = data.get("config_json")
    config = config if isinstance(config, dict) else {}

    if not name or not preset_key:
        return api_error("VALIDATION_ERROR", "name и preset_key обязательны", status=400)

    if Theme.query.filter_by(preset_key=preset_key).first():
        return api_error("CONFLICT", "preset_key уже существует", status=409)

    theme = Theme(name=name, preset_key=preset_key, config_json=sanitize_theme_config(config))
    db.session.add(theme)
    db.session.commit()
    return api_success({"theme": api_theme_dict(theme)}, status=201)


@app.route("/api/admin/themes/<int:theme_id>", methods=["PUT"])
@login_required
def api_admin_themes_update(theme_id: int):
    if not is_admin_user(current_user):
        return api_error("FORBIDDEN", "Доступ запрещён", status=403)

    theme = db.session.get(Theme, theme_id)
    if not theme:
        return api_error("NOT_FOUND", "Тема не найдена", status=404)

    data = request.get_json(silent=True) or {}
    if "name" in data:
        theme.name = (data.get("name") or "").strip() or theme.name
    if "config_json" in data:
        cfg = data.get("config_json")
        theme.config_json = sanitize_theme_config(cfg if isinstance(cfg, dict) else {})

    db.session.commit()
    return api_success({"theme": api_theme_dict(theme)})


@app.route("/api/admin/hero-presets")
@login_required
def api_admin_hero_presets_list():
    items = HeroPreset.query.order_by(HeroPreset.id.asc()).all()
    return api_success({"items": [api_hero_preset_dict(p) for p in items]})


def _normalize_hero_preset_key(raw: str) -> str | None:
    key = (raw or "").strip()
    if not key or len(key) > 80:
        return None
    for ch in key:
        if ch.isalnum() or ch in ("_", "-"):
            continue
        return None
    return key


@app.route("/api/admin/hero-presets", methods=["POST"])
@login_required
def api_admin_hero_presets_create():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    key = _normalize_hero_preset_key(data.get("key") or data.get("preset_key") or "")
    raw_cfg = data.get("config_json") if isinstance(data.get("config_json"), dict) else {}

    if not name or not key:
        return api_error("VALIDATION_ERROR", "name и key обязательны", status=400)

    if HeroPreset.query.filter_by(key=key).first():
        return api_error("CONFLICT", "key уже существует", status=409)

    safe_cfg, errors = sanitize_hero_config(raw_cfg, strict=True)
    if errors:
        return api_error("VALIDATION_ERROR", "Некорректные значения", status=400, details=errors)

    preset = HeroPreset(name=name, key=key, is_builtin=False, config_json=safe_cfg)
    db.session.add(preset)
    db.session.commit()
    return api_success({"preset": api_hero_preset_dict(preset)}, status=201)


@app.route("/api/admin/hero-presets/<int:preset_id>/duplicate", methods=["POST"])
@login_required
def api_admin_hero_presets_duplicate(preset_id: int):
    preset = db.session.get(HeroPreset, preset_id)
    if not preset:
        return api_error("NOT_FOUND", "Hero preset не найден", status=404)

    base_key = _normalize_hero_preset_key(preset.key or "") or f"preset_{preset.id}"
    new_key = f"{base_key}_{secrets.token_hex(3)}"
    new_name = f"{preset.name} Copy"

    safe_cfg = sanitize_hero_config(getattr(preset, "config_json", None), strict=False)[0]
    clone = HeroPreset(name=new_name, key=new_key, is_builtin=False, config_json=safe_cfg)
    db.session.add(clone)
    db.session.commit()
    return api_success({"preset": api_hero_preset_dict(clone)}, status=201)


@app.route("/api/admin/hero-presets/<int:preset_id>", methods=["PUT"])
@login_required
def api_admin_hero_presets_update(preset_id: int):
    preset = db.session.get(HeroPreset, preset_id)
    if not preset:
        return api_error("NOT_FOUND", "Hero preset не найден", status=404)

    if getattr(preset, "is_builtin", False):
        return api_error("FORBIDDEN", "Нельзя редактировать встроенный preset", status=403)

    data = request.get_json(silent=True) or {}
    if "name" in data:
        preset.name = (data.get("name") or "").strip() or preset.name
    if "config_json" in data:
        raw_cfg = data.get("config_json") if isinstance(data.get("config_json"), dict) else {}
        safe_cfg, errors = sanitize_hero_config(raw_cfg, strict=True)
        if errors:
            return api_error("VALIDATION_ERROR", "Некорректные значения", status=400, details=errors)
        preset.config_json = safe_cfg

    db.session.commit()
    return api_success({"preset": api_hero_preset_dict(preset)})


@app.route("/api/admin/restaurants/<int:restaurant_id>/logo", methods=["POST"])
@login_required
def api_admin_restaurant_logo(restaurant_id: int):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or not has_restaurant_access(restaurant):
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)
    file = request.files.get("file") or request.files.get("logo")
    old_logo = getattr(restaurant, "logo_filename", None)
    try:
        restaurant.logo_filename = save_logo_upload(file, LOGO_FOLDER, field_name="logo")
    except ApiUploadError as e:
        return api_error(e.code, e.message, status=e.status, details=e.details)
    db.session.commit()
    if old_logo and old_logo != restaurant.logo_filename:
        safe_delete_uploaded_file(old_logo, required_top_dir="logos")
    return api_success({"restaurant": api_restaurant_dict(restaurant)})


@app.route("/api/admin/restaurants/<int:restaurant_id>/logo", methods=["DELETE"])
@login_required
def api_admin_restaurant_logo_delete(restaurant_id: int):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or not has_restaurant_access(restaurant):
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)
    old_logo = getattr(restaurant, "logo_filename", None)
    restaurant.logo_filename = None
    db.session.commit()
    if old_logo:
        safe_delete_uploaded_file(old_logo, required_top_dir="logos")
    return api_success({"restaurant": api_restaurant_dict(restaurant)})


@app.route("/api/admin/restaurants/<int:restaurant_id>/qr")
@login_required
def api_admin_restaurant_qr(restaurant_id: int):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or not has_restaurant_access(restaurant):
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)

    menu_url = url_for("public_menu", slug=restaurant.slug, _external=True)
    qr_path = QR_FOLDER / f"restaurant_{restaurant.id}.png"
    force = str(request.args.get("force") or "").strip() == "1"

    if force or not qr_path.is_file():
        img = qrcode.make(menu_url)
        img.save(qr_path)

    qr_filename = str(qr_path.relative_to(UPLOAD_ROOT))
    return api_success(
        {
            "menu_url": menu_url,
            "qr_path": qr_filename,
            "qr_url": url_for("uploaded_file", filename=qr_filename),
        }
    )


@app.route("/api/admin/restaurants/<int:restaurant_id>/fonts")
@login_required
def api_admin_restaurant_fonts(restaurant_id: int):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or not has_restaurant_access(restaurant):
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)

    folder = FONT_FOLDER / f"r{restaurant.id}"
    folder.mkdir(parents=True, exist_ok=True)

    items = []
    for p in sorted(folder.glob("*")):
        if not p.is_file():
            continue
        if p.suffix.lower() not in ALLOWED_FONT_EXTS:
            continue
        rel = str(p.relative_to(UPLOAD_ROOT))
        items.append(
            {
                "path": rel,
                "filename": p.name,
                "url": url_for("uploaded_file", filename=rel),
            }
        )
    return api_success({"items": items})


@app.route("/api/admin/restaurants/<int:restaurant_id>/fonts/upload", methods=["POST"])
@login_required
def api_admin_restaurant_fonts_upload(restaurant_id: int):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or not has_restaurant_access(restaurant):
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)

    file = request.files.get("file") or request.files.get("font")
    folder = FONT_FOLDER / f"r{restaurant.id}"
    try:
        rel = save_font_upload(file, folder, field_name="file")
    except ApiUploadError as e:
        return api_error(e.code, e.message, status=e.status, details=e.details)

    return api_success(
        {
            "ok": True,
            "path": rel,
            "filename": Path(rel).name,
            "url": url_for("uploaded_file", filename=rel),
        }
    )


@app.route("/api/admin/restaurants/<int:restaurant_id>/fonts", methods=["DELETE"])
@login_required
def api_admin_restaurant_fonts_delete(restaurant_id: int):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or not has_restaurant_access(restaurant):
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)

    raw = (request.args.get("path") or "").strip()
    if not raw:
        return api_error("VALIDATION_ERROR", "path обязателен", status=400)

    try:
        p = Path(raw)
    except Exception:
        return api_error("VALIDATION_ERROR", "Некорректный путь", status=400)

    if p.is_absolute() or ".." in p.parts:
        return api_error("VALIDATION_ERROR", "Некорректный путь", status=400)

    normalized = p.as_posix().lstrip("/")
    expected_prefix = f"fonts/r{restaurant.id}/"
    if not normalized.startswith(expected_prefix):
        return api_error("VALIDATION_ERROR", "Некорректный путь", status=400)

    full = UPLOAD_ROOT / normalized
    if not full.is_file():
        return api_error("NOT_FOUND", "Файл не найден", status=404)
    if full.suffix.lower() not in ALLOWED_FONT_EXTS:
        return api_error("VALIDATION_ERROR", "Неподдерживаемый формат файла", status=400)

    try:
        full.unlink()
    except Exception:
        return api_error("INTERNAL_ERROR", "Не удалось удалить файл", status=500)

    # If the restaurant was using this font, revert to default.
    if restaurant.menu_font == normalized:
        restaurant.menu_font = "serif"
        db.session.commit()

    return api_success({"ok": True})


@app.route("/api/admin/restaurants/<int:restaurant_id>/loaders")
@login_required
def api_admin_restaurant_loaders(restaurant_id: int):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or not has_restaurant_access(restaurant):
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)

    folder = LOADER_FOLDER / f"r{restaurant.id}"
    folder.mkdir(parents=True, exist_ok=True)

    items = []
    for p in sorted(folder.glob("*")):
        if not p.is_file():
            continue
        if p.suffix.lower() not in ALLOWED_LOADER_EXTS:
            continue
        rel = str(p.relative_to(UPLOAD_ROOT))
        items.append({"path": rel, "filename": p.name, "url": url_for("uploaded_file", filename=rel)})
    return api_success({"items": items})


@app.route("/api/admin/restaurants/<int:restaurant_id>/loaders/upload", methods=["POST"])
@login_required
def api_admin_restaurant_loaders_upload(restaurant_id: int):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or not has_restaurant_access(restaurant):
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)

    file = request.files.get("file") or request.files.get("loader")
    folder = LOADER_FOLDER / f"r{restaurant.id}"
    try:
        rel = save_loader_upload(file, folder, field_name="file")
    except ApiUploadError as e:
        return api_error(e.code, e.message, status=e.status, details=e.details)

    return api_success({"ok": True, "path": rel, "filename": Path(rel).name, "url": url_for("uploaded_file", filename=rel)})


@app.route("/api/admin/restaurants/<int:restaurant_id>/loaders", methods=["DELETE"])
@login_required
def api_admin_restaurant_loaders_delete(restaurant_id: int):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or not has_restaurant_access(restaurant):
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)

    raw = (request.args.get("path") or "").strip()
    if not raw:
        return api_error("VALIDATION_ERROR", "path обязателен", status=400)

    try:
        normalized = normalize_restaurant_loader_path(raw, restaurant_id=restaurant.id)
    except ApiUploadError as e:
        return api_error(e.code, e.message, status=e.status, details=e.details)

    if not normalized:
        return api_error("VALIDATION_ERROR", "Некорректный путь", status=400)

    full = UPLOAD_ROOT / normalized
    if not full.is_file():
        return api_error("NOT_FOUND", "Файл не найден", status=404)

    try:
        full.unlink()
    except Exception:
        return api_error("INTERNAL_ERROR", "Не удалось удалить файл", status=500)

    if getattr(restaurant, "loading_image_path", None) == normalized:
        restaurant.loading_image_path = None
        db.session.commit()

    return api_success({"ok": True})


@app.route("/api/admin/restaurants/<int:restaurant_id>/categories")
@login_required
def api_admin_categories_list(restaurant_id: int):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or not has_restaurant_access(restaurant):
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)

    items = (
        Category.query.filter_by(restaurant_id=restaurant.id)
        .order_by(Category.sort_order, Category.name)
        .all()
    )
    return api_success({"items": [api_category_dict(c) for c in items]})


@app.route("/api/admin/restaurants/<int:restaurant_id>/categories", methods=["POST"])
@login_required
def api_admin_categories_create(restaurant_id: int):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or not has_restaurant_access(restaurant):
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    icon_name = (data.get("icon_name") or "").strip() or None
    try:
        image_path = normalize_category_image_path(data.get("image_path"), restaurant_id=restaurant.id)
    except ApiUploadError as e:
        return api_error(e.code, e.message, status=e.status, details=e.details)
    if not name:
        return api_error("VALIDATION_ERROR", "Поле name обязательно", status=400)

    max_sort = (
        db.session.query(db.func.max(Category.sort_order))
        .filter_by(restaurant_id=restaurant.id)
        .scalar()
        or 0
    )
    cat = Category(
        name=name,
        icon_name=icon_name,
        image_path=image_path,
        restaurant_id=restaurant.id,
        sort_order=max_sort + 1,
    )
    db.session.add(cat)
    db.session.commit()
    return api_success({"category": api_category_dict(cat)}, status=201)


@app.route("/api/admin/categories/icons")
@login_required
def api_admin_category_icons():
    restaurant_id = api_parse_int(request.args.get("restaurant_id"))
    if not restaurant_id:
        return api_error("VALIDATION_ERROR", "restaurant_id обязателен", status=400)

    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or not has_restaurant_access(restaurant):
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)

    folder = CATEGORY_FOLDER / f"r{restaurant_id}"
    folder.mkdir(parents=True, exist_ok=True)

    items = []
    for p in sorted(folder.glob("*")):
        if not p.is_file():
            continue
        if p.suffix.lower() not in ALLOWED_CATEGORY_ICON_EXTS:
            continue
        rel = str(p.relative_to(UPLOAD_ROOT))
        items.append(
            {
                "path": rel,
                "filename": p.name,
                "url": url_for("uploaded_file", filename=rel),
            }
        )

    return api_success({"items": items})


@app.route("/api/admin/categories/icons", methods=["DELETE"])
@login_required
def api_admin_category_icons_delete():
    restaurant_id = api_parse_int(request.args.get("restaurant_id"))
    if not restaurant_id:
        return api_error("VALIDATION_ERROR", "restaurant_id обязателен", status=400)

    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or not has_restaurant_access(restaurant):
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)

    raw = (request.args.get("path") or "").strip()
    if not raw:
        return api_error("VALIDATION_ERROR", "path обязателен", status=400)

    try:
        p = Path(raw)
    except Exception:
        return api_error("VALIDATION_ERROR", "Некорректный путь", status=400)

    if p.is_absolute() or ".." in p.parts:
        return api_error("VALIDATION_ERROR", "Некорректный путь", status=400)

    normalized = p.as_posix().lstrip("/")
    expected_prefix = f"categories/r{restaurant.id}/"
    if not normalized.startswith(expected_prefix):
        return api_error("VALIDATION_ERROR", "Некорректный путь", status=400)

    full = UPLOAD_ROOT / normalized
    if not full.is_file():
        return api_error("NOT_FOUND", "Файл не найден", status=404)
    if full.suffix.lower() not in ALLOWED_CATEGORY_ICON_EXTS:
        return api_error("VALIDATION_ERROR", "Неподдерживаемый формат файла", status=400)

    try:
        full.unlink()
    except Exception:
        return api_error("INTERNAL_ERROR", "Не удалось удалить файл", status=500)

    # Clear category.image_path if it referenced deleted file.
    Category.query.filter_by(restaurant_id=restaurant.id, image_path=normalized).update({"image_path": None})
    db.session.commit()

    return api_success({"ok": True})


@app.route("/api/admin/categories/upload-icon", methods=["POST"])
@login_required
def api_admin_category_upload_icon():
    restaurant_id = api_parse_int(request.args.get("restaurant_id") or request.form.get("restaurant_id"))
    if not restaurant_id:
        return api_error("VALIDATION_ERROR", "restaurant_id обязателен", status=400)

    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or not has_restaurant_access(restaurant):
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)

    file = request.files.get("file") or request.files.get("icon") or request.files.get("image")
    folder = CATEGORY_FOLDER / f"r{restaurant_id}"
    try:
        rel = save_category_icon_upload(file, folder, field_name="file")
    except ApiUploadError as e:
        return api_error(e.code, e.message, status=e.status, details=e.details)

    return api_success(
        {
            "ok": True,
            "path": rel,
            "filename": Path(rel).name,
            "url": url_for("uploaded_file", filename=rel),
        }
    )


@app.route("/api/admin/categories/<int:category_id>", methods=["PATCH"])
@login_required
def api_admin_category_update(category_id: int):
    cat = db.session.get(Category, category_id)
    if not cat or not has_restaurant_access(cat.restaurant):
        return api_error("NOT_FOUND", "Категория не найдена", status=404)

    data = request.get_json(silent=True) or {}
    if "name" in data:
        cat.name = (data.get("name") or "").strip() or cat.name
    if "icon_name" in data:
        cat.icon_name = (data.get("icon_name") or "").strip() or None
    if "image_path" in data:
        try:
            cat.image_path = normalize_category_image_path(data.get("image_path"), restaurant_id=cat.restaurant_id)
        except ApiUploadError as e:
            return api_error(e.code, e.message, status=e.status, details=e.details)
    db.session.commit()
    return api_success({"category": api_category_dict(cat)})


@app.route("/api/admin/categories/<int:category_id>/header-style")
@login_required
def api_admin_category_header_style_get(category_id: int):
    cat = db.session.get(Category, category_id)
    if not cat or not has_restaurant_access(cat.restaurant):
        return api_error("NOT_FOUND", "Категория не найдена", status=404)

    effective, overrides = category_effective_header_style(cat.restaurant, cat)
    return api_success({"header_style": effective, "overrides": overrides})


@app.route("/api/admin/categories/<int:category_id>/header-style", methods=["PUT"])
@login_required
def api_admin_category_header_style_put(category_id: int):
    cat = db.session.get(Category, category_id)
    if not cat or not has_restaurant_access(cat.restaurant):
        return api_error("NOT_FOUND", "Категория не найдена", status=404)

    payload = request.get_json(silent=True)
    if payload is None:
        raw = (request.get_data() or b"").strip()
        if raw == b"null":
            cat.header_style_json = None
            db.session.commit()
            effective, overrides = category_effective_header_style(cat.restaurant, cat)
            return api_success({"header_style": effective, "overrides": overrides})
        return api_error("VALIDATION_ERROR", "Некорректный JSON", status=400)

    if not isinstance(payload, dict):
        return api_error("VALIDATION_ERROR", "Ожидается объект JSON или null", status=400)

    safe, errors = sanitize_header_style(payload, strict=True)
    if errors:
        return api_error("VALIDATION_ERROR", "Некорректные значения", status=400, details=errors)

    cat.header_style_json = safe or None
    db.session.commit()
    effective, overrides = category_effective_header_style(cat.restaurant, cat)
    return api_success({"header_style": effective, "overrides": overrides})


@app.route("/api/admin/categories/<int:category_id>", methods=["DELETE"])
@login_required
def api_admin_category_delete(category_id: int):
    cat = db.session.get(Category, category_id)
    if not cat or not has_restaurant_access(cat.restaurant):
        return api_error("NOT_FOUND", "Категория не найдена", status=404)
    db.session.delete(cat)
    db.session.commit()
    return api_success({"ok": True})


@app.route("/api/admin/restaurants/<int:restaurant_id>/dishes")
@login_required
def api_admin_dishes_list(restaurant_id: int):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or not has_restaurant_access(restaurant):
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)

    q = (request.args.get("q") or "").strip()
    page, page_size = api_page_args()

    query = Dish.query.join(Category).filter(Category.restaurant_id == restaurant.id)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(Dish.name.ilike(like), Dish.description.ilike(like)))

    total = query.count()
    items = (
        query.order_by(Dish.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return api_success({"items": [api_dish_dict(d) for d in items], "total": total, "page": page, "page_size": page_size})


@app.route("/api/admin/restaurants/<int:restaurant_id>/dishes", methods=["POST"])
@login_required
def api_admin_dishes_create(restaurant_id: int):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or not has_restaurant_access(restaurant):
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)

    form = request.form or {}
    name = (form.get("name") or "").strip()
    description = (form.get("description") or "").strip() or None
    price = form.get("price")
    currency = (form.get("currency") or "AMD").strip()
    category_id = api_parse_int(form.get("category_id"))

    if not name or price is None or not category_id:
        return api_error("VALIDATION_ERROR", "Нужно указать name, price и category_id", status=400)

    category = db.session.get(Category, category_id)
    if not category or category.restaurant_id != restaurant.id:
        return api_error("VALIDATION_ERROR", "Некорректная категория", status=400)

    image_file = request.files.get("image")
    image_filename = None
    if image_file:
        try:
            image_filename = save_dish_image_upload(image_file, DISH_FOLDER, field_name="image")
        except ApiUploadError as e:
            return api_error(e.code, e.message, status=e.status, details=e.details)
        # Generate responsive variants eagerly (fast, avoids layout shift on client).
        image_variants = build_dish_image_variants(image_filename)
    else:
        image_variants = None

    try:
        price_value = float(price)
    except Exception:
        return api_error("VALIDATION_ERROR", "Некорректная цена", status=400)

    dish = Dish(
        name=name,
        description=description,
        price=price_value,
        currency=currency,
        category_id=category.id,
        available=api_parse_bool(form.get("available"), True),
        is_spicy=api_parse_bool(form.get("is_spicy"), False),
        is_vegan=api_parse_bool(form.get("is_vegan"), False),
        image_filename=image_filename,
        image_variants_json=image_variants or None,
        processed_image_filename=None,
        processed_image_variants_json=None,
        image_remove_bg_status=None,
        image_remove_bg_error=None,
        use_processed_image=False,
    )
    db.session.add(dish)
    db.session.commit()
    if image_filename and bool(getattr(restaurant, "menu_card_remove_bg_on_upload", False)):
        try:
            enqueue_dish_remove_bg_job(dish)
            db.session.commit()
        except Exception:
            db.session.rollback()
    return api_success({"dish": api_dish_dict(dish)}, status=201)


@app.route("/api/admin/dishes/<int:dish_id>", methods=["PATCH"])
@login_required
def api_admin_dish_update(dish_id: int):
    dish = db.session.get(Dish, dish_id)
    if not dish or not has_restaurant_access(dish.category.restaurant):
        return api_error("NOT_FOUND", "Блюдо не найдено", status=404)

    form = request.form or {}

    if "name" in form:
        dish.name = (form.get("name") or "").strip() or dish.name
    if "description" in form:
        dish.description = (form.get("description") or "").strip() or None
    if "price" in form:
        try:
            dish.price = float(form.get("price"))
        except Exception:
            pass
    if "currency" in form:
        dish.currency = (form.get("currency") or dish.currency).strip()
    if "category_id" in form:
        new_cat_id = api_parse_int(form.get("category_id"))
        new_cat = db.session.get(Category, new_cat_id) if new_cat_id else None
        if new_cat and new_cat.restaurant_id == dish.category.restaurant_id:
            dish.category_id = new_cat.id

    if "available" in form:
        dish.available = api_parse_bool(form.get("available"), True)
    if "is_spicy" in form:
        dish.is_spicy = api_parse_bool(form.get("is_spicy"), False)
    if "is_vegan" in form:
        dish.is_vegan = api_parse_bool(form.get("is_vegan"), False)

    image_file = request.files.get("image")
    if image_file:
        old_image = dish.image_filename
        old_variants = getattr(dish, "image_variants_json", None)
        old_processed = getattr(dish, "processed_image_filename", None)
        old_processed_variants = getattr(dish, "processed_image_variants_json", None)
        try:
            dish.image_filename = save_dish_image_upload(image_file, DISH_FOLDER, field_name="image")
        except ApiUploadError as e:
            return api_error(e.code, e.message, status=e.status, details=e.details)
        if old_image and old_image != dish.image_filename:
            safe_delete_uploaded_file(old_image, required_top_dir="dishes")
        if isinstance(old_variants, dict):
            for p in old_variants.values():
                if isinstance(p, str) and p:
                    safe_delete_uploaded_file(p, required_top_dir="dishes")
        if old_processed:
            safe_delete_uploaded_file(old_processed, required_top_dir="dishes")
        if isinstance(old_processed_variants, dict):
            for p in old_processed_variants.values():
                if isinstance(p, str) and p:
                    safe_delete_uploaded_file(p, required_top_dir="dishes")

        dish.image_variants_json = build_dish_image_variants(dish.image_filename) or None
        dish.processed_image_filename = None
        dish.processed_image_variants_json = None
        dish.image_remove_bg_status = None
        dish.image_remove_bg_error = None
        dish.use_processed_image = False

    db.session.commit()
    if image_file:
        try:
            restaurant = dish.category.restaurant
        except Exception:
            restaurant = None
        if restaurant and bool(getattr(restaurant, "menu_card_remove_bg_on_upload", False)) and dish.image_filename:
            try:
                enqueue_dish_remove_bg_job(dish)
                db.session.commit()
            except Exception:
                db.session.rollback()
    return api_success({"dish": api_dish_dict(dish)})


@app.route("/api/admin/dishes/<int:dish_id>/image")
@login_required
def api_admin_dish_image_get(dish_id: int):
    dish = db.session.get(Dish, dish_id)
    if not dish or not has_restaurant_access(dish.category.restaurant):
        return api_error("NOT_FOUND", "Блюдо не найдено", status=404)

    processed = getattr(dish, "processed_image_filename", None)
    processed_url = url_for("uploaded_file", filename=processed) if processed else None
    processed_srcset = None
    if hasattr(dish, "processed_image_variants_json") and isinstance(getattr(dish, "processed_image_variants_json", None), dict):
        parts = []
        for k, v in sorted((dish.processed_image_variants_json or {}).items(), key=lambda kv: int(kv[0]) if str(kv[0]).isdigit() else 10**9):
            try:
                w = int(k)
            except Exception:
                continue
            if isinstance(v, str) and v:
                parts.append(f"{url_for('uploaded_file', filename=v)} {w}w")
        processed_srcset = ", ".join(parts) if parts else None

    return api_success(
        {
            "image_url": dish.image_url(),
            "image_srcset": dish.image_srcset() if hasattr(dish, "image_srcset") else None,
            "processed_image_url": processed_url,
            "processed_image_srcset": processed_srcset,
            "status": getattr(dish, "image_remove_bg_status", None),
            "error": getattr(dish, "image_remove_bg_error", None),
            "use_processed_image": bool(getattr(dish, "use_processed_image", False)),
        }
    )


@app.route("/api/admin/dishes/<int:dish_id>/image/remove-bg", methods=["POST"])
@login_required
def api_admin_dish_image_remove_bg(dish_id: int):
    dish = db.session.get(Dish, dish_id)
    if not dish or not has_restaurant_access(dish.category.restaurant):
        return api_error("NOT_FOUND", "Блюдо не найдено", status=404)
    if not dish.image_filename:
        return api_error("VALIDATION_ERROR", "У блюда нет изображения", status=400)

    # Prevent piling up duplicate queued jobs.
    existing = DishImageJob.query.filter(
        DishImageJob.dish_id == dish.id,
        DishImageJob.job_type == "remove_bg",
        DishImageJob.status.in_(("queued", "processing")),
    ).first()
    if existing:
        return api_success({"ok": True, "status": dish.image_remove_bg_status or existing.status})

    enqueue_dish_remove_bg_job(dish)
    db.session.commit()
    return api_success({"ok": True, "status": dish.image_remove_bg_status})


@app.route("/api/admin/dishes/<int:dish_id>/image/use-original", methods=["POST"])
@login_required
def api_admin_dish_image_use_original(dish_id: int):
    dish = db.session.get(Dish, dish_id)
    if not dish or not has_restaurant_access(dish.category.restaurant):
        return api_error("NOT_FOUND", "Блюдо не найдено", status=404)
    dish.use_processed_image = False
    db.session.commit()
    return api_success({"ok": True, "use_processed_image": False})


@app.route("/api/admin/dishes/<int:dish_id>/image/use-processed", methods=["POST"])
@login_required
def api_admin_dish_image_use_processed(dish_id: int):
    dish = db.session.get(Dish, dish_id)
    if not dish or not has_restaurant_access(dish.category.restaurant):
        return api_error("NOT_FOUND", "Блюдо не найдено", status=404)
    if not getattr(dish, "processed_image_filename", None) or getattr(dish, "image_remove_bg_status", None) != "done":
        return api_error("VALIDATION_ERROR", "Processed image not ready", status=400)
    dish.use_processed_image = True
    db.session.commit()
    return api_success({"ok": True, "use_processed_image": True})


def _is_unsafe_rich_text(value: str) -> bool:
    lowered = (value or "").lower()
    needles = ("<script", "javascript:", "onload=", "onerror=", "<iframe", "<object", "<embed")
    return any(n in lowered for n in needles)


@app.route("/api/admin/dishes/<int:dish_id>/translations")
@login_required
def api_admin_dish_translations_get(dish_id: int):
    dish = db.session.get(Dish, dish_id)
    if not dish or not has_restaurant_access(dish.category.restaurant):
        return api_error("NOT_FOUND", "Блюдо не найдено", status=404)

    raw_langs = (request.args.get("langs") or "").strip()
    requested_langs = []
    if raw_langs:
        for part in raw_langs.split(","):
            code = part.strip()
            if code and code in LANGUAGES:
                requested_langs.append(code)
    if not requested_langs:
        requested_langs = list(LANGUAGES.keys())

    existing_rows = (
        DishTranslation.query.filter(DishTranslation.dish_id == dish.id, DishTranslation.lang.in_(requested_langs))
        .all()
    )
    row_by_lang = {r.lang: r for r in existing_rows}

    updated = False
    name_trans = dish.name_translations or {}
    desc_trans = dish.description_translations or {}

    def ensure_row(lang: str) -> DishTranslation:
        nonlocal updated
        row = row_by_lang.get(lang)
        if row is None:
            row = DishTranslation(dish_id=dish.id, lang=lang)
            db.session.add(row)
            row_by_lang[lang] = row
            updated = True
        return row

    def ensure_auto(lang: str) -> tuple[str, str]:
        nonlocal updated, name_trans, desc_trans
        # DEFAULT_LANG uses canonical fields.
        if lang == DEFAULT_LANG:
            auto_title = dish.name or ""
            auto_description = dish.description or ""
            return auto_title, auto_description

        auto_title = (name_trans.get(lang) or "").strip()
        auto_description = (desc_trans.get(lang) or "").strip()

        row = row_by_lang.get(lang)
        if not auto_title and row and (row.auto_title or "").strip():
            auto_title = row.auto_title.strip()
            name_trans[lang] = auto_title
            dish.name_translations = name_trans
            updated = True
        if not auto_description and row and (row.auto_description or "").strip():
            auto_description = row.auto_description.strip()
            desc_trans[lang] = auto_description
            dish.description_translations = desc_trans
            updated = True

        if translator_type:
            if not auto_title and dish.name:
                translated = translate_text(dish.name, lang)
                if translated:
                    auto_title = translated.strip()
                    name_trans[lang] = auto_title
                    dish.name_translations = name_trans
                    row = ensure_row(lang)
                    row.auto_title = auto_title
                    updated = True
            if not auto_description and dish.description:
                translated_desc = translate_text(dish.description, lang)
                if translated_desc:
                    auto_description = translated_desc.strip()
                    desc_trans[lang] = auto_description
                    dish.description_translations = desc_trans
                    row = ensure_row(lang)
                    row.auto_description = auto_description
                    updated = True

        # Keep DB row in sync with JSON auto translations if present.
        if (auto_title or auto_description) and lang != DEFAULT_LANG:
            row = ensure_row(lang)
            if auto_title and (row.auto_title or "").strip() != auto_title:
                row.auto_title = auto_title
                updated = True
            if (auto_description or "") and (row.auto_description or "").strip() != auto_description:
                row.auto_description = auto_description
                updated = True

        return auto_title, auto_description

    items = []
    for lang in requested_langs:
        row = row_by_lang.get(lang)
        auto_title, auto_description = ensure_auto(lang)
        manual_title = (row.manual_title if row else None)
        manual_description = (row.manual_description if row else None)
        items.append(
            {
                "lang": lang,
                "auto": {"title": auto_title or "", "description": auto_description or ""},
                "manual": {"title": manual_title, "description": manual_description},
            }
        )

    if updated:
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()

    return api_success({"items": items})


@app.route("/api/admin/dishes/<int:dish_id>/translations/<lang>", methods=["PUT"])
@login_required
def api_admin_dish_translations_put(dish_id: int, lang: str):
    dish = db.session.get(Dish, dish_id)
    if not dish or not has_restaurant_access(dish.category.restaurant):
        return api_error("NOT_FOUND", "Блюдо не найдено", status=404)

    lang = (lang or "").strip()
    if lang not in LANGUAGES:
        return api_error("VALIDATION_ERROR", "Некорректный язык", status=400)

    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return api_error("VALIDATION_ERROR", "Некорректный формат данных", status=400)

    def normalize_manual(value) -> str | None:
        if value is None:
            return None
        text_value = str(value).strip()
        return text_value or None

    manual_title = normalize_manual(data.get("manual_title")) if "manual_title" in data else None
    manual_description = normalize_manual(data.get("manual_description")) if "manual_description" in data else None

    for value in (manual_title, manual_description):
        if value and _is_unsafe_rich_text(value):
            return api_error("VALIDATION_ERROR", "Текст содержит недопустимые элементы", status=400)

    row = DishTranslation.query.filter_by(dish_id=dish.id, lang=lang).first()
    if not row:
        row = DishTranslation(dish_id=dish.id, lang=lang)
        db.session.add(row)

    if "manual_title" in data:
        row.manual_title = manual_title
    if "manual_description" in data:
        row.manual_description = manual_description

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return api_error("INTERNAL_ERROR", "Не удалось сохранить перевод", status=500)

    return api_success(
        {
            "lang": lang,
            "auto": {"title": row.auto_title or "", "description": row.auto_description or ""},
            "manual": {"title": row.manual_title, "description": row.manual_description},
        }
    )


@app.route("/api/admin/dishes/<int:dish_id>", methods=["DELETE"])
@login_required
def api_admin_dish_delete(dish_id: int):
    dish = db.session.get(Dish, dish_id)
    if not dish or not has_restaurant_access(dish.category.restaurant):
        return api_error("NOT_FOUND", "Блюдо не найдено", status=404)
    old_image = dish.image_filename
    db.session.delete(dish)
    db.session.commit()
    if old_image:
        safe_delete_uploaded_file(old_image, required_top_dir="dishes")
    return api_success({"ok": True})


@app.route("/api/admin/restaurants/<int:restaurant_id>/tables")
@login_required
def api_admin_tables_list(restaurant_id: int):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or not has_restaurant_access(restaurant):
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)

    items = (
        DiningTable.query.filter_by(restaurant_id=restaurant.id)
        .order_by(DiningTable.number)
        .all()
    )
    return api_success({"items": [api_table_dict(t) for t in items]})


@app.route("/api/admin/restaurants/<int:restaurant_id>/tables", methods=["POST"])
@login_required
def api_admin_tables_create(restaurant_id: int):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or not has_restaurant_access(restaurant):
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)

    data = request.get_json(silent=True) or {}
    number = api_parse_int(data.get("number"))
    if not number:
        return api_error("VALIDATION_ERROR", "Поле number обязательно", status=400)

    existing = DiningTable.query.filter_by(restaurant_id=restaurant.id, number=number).first()
    if existing:
        return api_error("CONFLICT", "Стол с таким номером уже существует", status=409)

    tbl = DiningTable(number=number, restaurant_id=restaurant.id, is_occupied=False)
    db.session.add(tbl)
    db.session.commit()
    return api_success({"table": api_table_dict(tbl)}, status=201)


@app.route("/api/admin/tables/<int:table_id>", methods=["PATCH"])
@login_required
def api_admin_table_update(table_id: int):
    tbl = db.session.get(DiningTable, table_id)
    if not tbl or not has_restaurant_access(tbl.restaurant):
        return api_error("NOT_FOUND", "Стол не найден", status=404)

    data = request.get_json(silent=True) or {}
    if "is_occupied" in data:
        tbl.is_occupied = bool(data.get("is_occupied"))
    if "number" in data:
        n = api_parse_int(data.get("number"))
        if n:
            tbl.number = n

    db.session.commit()
    return api_success({"table": api_table_dict(tbl)})


@app.route("/api/admin/tables/<int:table_id>", methods=["DELETE"])
@login_required
def api_admin_table_delete(table_id: int):
    tbl = db.session.get(DiningTable, table_id)
    if not tbl or not has_restaurant_access(tbl.restaurant):
        return api_error("NOT_FOUND", "Стол не найден", status=404)
    db.session.delete(tbl)
    db.session.commit()
    return api_success({"ok": True})


@app.route("/api/admin/users")
@login_required
def api_admin_users_list():
    if not is_admin_user(current_user):
        return api_error("FORBIDDEN", "Доступ запрещён", status=403)

    page, page_size = api_page_args()
    query = User.query.order_by(User.id.desc())
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return api_success({"items": [api_user_dict(u) for u in items], "total": total, "page": page, "page_size": page_size})


def resolve_public_lang_arg() -> str:
    lang = request.args.get("lang") or DEFAULT_LANG
    if lang not in LANGUAGES:
        lang = DEFAULT_LANG
    return lang


def public_restaurant_payload(restaurant: Restaurant, lang: str) -> dict:
    # IMPORTANT: restaurant name is never auto-translated (brand identity).
    updated = False
    if lang != DEFAULT_LANG and translator_type:
        desc_trans = restaurant.description_translations or {}
        if not desc_trans.get(lang) and restaurant.description:
            translated = translate_text(restaurant.description, lang)
            if translated:
                desc_trans[lang] = translated
                restaurant.description_translations = desc_trans
                updated = True

        if updated:
            try:
                db.session.commit()
            except Exception:
                db.session.rollback()

    header_style = restaurant_effective_header_style(restaurant)
    header_overrides, _ = sanitize_header_style(getattr(restaurant, "header_style_json", None), strict=False)
    menu_card = restaurant_effective_menu_card(restaurant)

    return {
        "id": restaurant.id,
        "slug": restaurant.slug,
        "name": restaurant.name,
        "description": restaurant.translated_description(lang),
        "logo_url": restaurant.logo_url(),
        "phone": getattr(restaurant, "phone", None),
        "whatsapp": getattr(restaurant, "whatsapp", None),
        "instagram": getattr(restaurant, "instagram", None),
        "facebook": getattr(restaurant, "facebook", None),
        "theme": restaurant_effective_theme(restaurant),
        "legacy_theme": restaurant.theme,
        "header_style": header_style,
        "header_style_overrides": header_overrides,
        "hero": restaurant_effective_hero(restaurant),
        "menu_card": {
            "preset_key": menu_card.get("preset_key"),
            "name": menu_card.get("name"),
            "config": menu_card.get("config") or {},
        },
        "menu_font": restaurant.menu_font,
        "menu_font_size": getattr(restaurant, "menu_font_size", None),
        "menu_font_brand": getattr(restaurant, "menu_font_brand", None),
        "menu_font_brand_size": getattr(restaurant, "menu_font_brand_size", None),
        "menu_font_category": getattr(restaurant, "menu_font_category", None),
        "menu_font_category_size": getattr(restaurant, "menu_font_category_size", None),
        "menu_font_item": getattr(restaurant, "menu_font_item", None),
        "menu_font_item_size": getattr(restaurant, "menu_font_item_size", None),
        "loading_image_path": getattr(restaurant, "loading_image_path", None),
        "loading_image_url": restaurant.loading_image_url() if hasattr(restaurant, "loading_image_url") else None,
        "loading_style": getattr(restaurant, "loading_style", None) or "spinner",
    }


def public_categories_payload(restaurant: Restaurant, lang: str) -> list[dict]:
    categories = (
        Category.query.options(selectinload(Category.dishes))
        .filter_by(restaurant_id=restaurant.id)
        .order_by(Category.sort_order, Category.name)
        .all()
    )

    updated = False
    dish_ids = []
    for c in categories:
        for d in (c.dishes or []):
            if d and d.id:
                dish_ids.append(d.id)
    dish_ids = list(dict.fromkeys(dish_ids))
    dish_translation_by_dish_id: dict[int, DishTranslation] = {}
    if dish_ids:
        rows = DishTranslation.query.filter(
            DishTranslation.dish_id.in_(dish_ids),
            DishTranslation.lang == lang,
        ).all()
        dish_translation_by_dish_id = {r.dish_id: r for r in rows}

    def is_blank(value: str | None) -> bool:
        return value is None or not str(value).strip()

    def maybe_translate_attr(obj, attr: str, translations_attr: str, original: str | None) -> str:
        nonlocal updated
        if lang == DEFAULT_LANG:
            return original or ""
        translations = getattr(obj, translations_attr, None) or {}
        current = translations.get(lang)
        if current:
            return current
        if translator_type and original:
            translated = translate_text(original, lang)
            if translated:
                translations[lang] = translated
                setattr(obj, translations_attr, translations)
                updated = True
                return translated
        return original or ""

    def pub_dish(d: Dish) -> dict:
        row = dish_translation_by_dish_id.get(d.id)

        auto_name = d.name or ""
        auto_desc = d.description or ""
        if lang != DEFAULT_LANG:
            name_trans = d.name_translations or {}
            desc_trans = d.description_translations or {}

            auto_name = (name_trans.get(lang) or "").strip()
            auto_desc = (desc_trans.get(lang) or "").strip()

            if not auto_name and row and not is_blank(row.auto_title):
                auto_name = (row.auto_title or "").strip()
                name_trans[lang] = auto_name
                d.name_translations = name_trans
                updated = True
            if not auto_desc and row and not is_blank(row.auto_description):
                auto_desc = (row.auto_description or "").strip()
                desc_trans[lang] = auto_desc
                d.description_translations = desc_trans
                updated = True

            if translator_type:
                if not auto_name and d.name:
                    translated = translate_text(d.name, lang)
                    if translated:
                        auto_name = translated.strip()
                        name_trans[lang] = auto_name
                        d.name_translations = name_trans
                        updated = True
                        if row:
                            if (row.auto_title or "").strip() != auto_name:
                                row.auto_title = auto_name
                                updated = True
                if not auto_desc and d.description:
                    translated_desc = translate_text(d.description, lang)
                    if translated_desc:
                        auto_desc = translated_desc.strip()
                        desc_trans[lang] = auto_desc
                        d.description_translations = desc_trans
                        updated = True
                        if row:
                            if (row.auto_description or "").strip() != auto_desc:
                                row.auto_description = auto_desc
                                updated = True

            if not auto_name:
                auto_name = d.name or ""
            if not auto_desc:
                auto_desc = d.description or ""

        name = row.manual_title if row and not is_blank(row.manual_title) else auto_name
        desc = row.manual_description if row and not is_blank(row.manual_description) else auto_desc
        return {
            "id": d.id,
            "name": name,
            "description": desc,
            "price": float(d.price),
            "currency": d.currency,
            "available": bool(d.available),
            "is_spicy": bool(d.is_spicy),
            "is_vegan": bool(d.is_vegan),
            "image_url": d.image_url(),
            "image_srcset": d.image_srcset() if hasattr(d, "image_srcset") else None,
            "category_id": d.category_id,
        }

    def pub_cat(c: Category) -> dict:
        name = maybe_translate_attr(c, "name", "name_translations", c.name)
        header_style, header_overrides = category_effective_header_style(restaurant, c)
        return {
            "id": c.id,
            "name": name,
            "icon_name": c.icon_name,
            "image_path": getattr(c, "image_path", None),
            "image_url": c.image_url() if hasattr(c, "image_url") else None,
            "header_style": header_style,
            "header_style_overrides": header_overrides,
            "dishes": [pub_dish(d) for d in (c.dishes or [])],
        }

    if updated:
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()

    return [pub_cat(c) for c in categories]


def public_table_payload(restaurant: Restaurant):
    table_number = api_parse_int(request.args.get("table"))
    if not table_number:
        return None
    table_obj = DiningTable.query.filter_by(restaurant_id=restaurant.id, number=table_number).first()
    if not table_obj:
        return None
    return {"number": table_obj.number, "is_occupied": bool(table_obj.is_occupied)}


@app.route("/api/public/restaurant/<slug>")
def api_public_restaurant(slug: str):
    lang = resolve_public_lang_arg()
    restaurant = Restaurant.query.filter_by(slug=slug).first()
    if not restaurant:
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)
    return api_success({"restaurant": public_restaurant_payload(restaurant, lang)})


@app.route("/api/public/restaurant/<slug>/menu")
def api_public_restaurant_menu(slug: str):
    lang = resolve_public_lang_arg()
    restaurant = Restaurant.query.filter_by(slug=slug).first()
    if not restaurant:
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)
    return api_success(
        {
            "categories": public_categories_payload(restaurant, lang),
            "table": public_table_payload(restaurant),
        }
    )


@app.route("/api/public/restaurants/<slug>/menu")
def api_public_menu(slug: str):
    lang = resolve_public_lang_arg()
    restaurant = Restaurant.query.filter_by(slug=slug).first()
    if not restaurant:
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)

    return api_success(
        {
            "restaurant": public_restaurant_payload(restaurant, lang),
            "table": public_table_payload(restaurant),
            "categories": public_categories_payload(restaurant, lang),
        }
    )


@app.route("/api/public/qr/<code>")
def api_public_qr(code: str):
    """Minimal QR resolver for SPA.

    Supported formats:
    - table_<id>  -> resolves DiningTable.id
    - <number>    -> resolves DiningTable.id (numeric)
    - <slug>--<table_number> -> resolves by restaurant slug + table number
    """
    code = (code or "").strip()
    if not code:
        return api_error("NOT_FOUND", "QR код не найден", status=404)

    table_obj = None
    if code.startswith("table_"):
        table_id = api_parse_int(code.replace("table_", "", 1))
        if table_id:
            table_obj = db.session.get(DiningTable, table_id)
    elif code.isdigit():
        table_obj = db.session.get(DiningTable, int(code))
    elif "--" in code:
        slug, table_str = code.rsplit("--", 1)
        table_number = api_parse_int(table_str)
        if slug and table_number:
            restaurant = Restaurant.query.filter_by(slug=slug).first()
            if restaurant:
                table_obj = DiningTable.query.filter_by(restaurant_id=restaurant.id, number=table_number).first()

    if not table_obj or not table_obj.restaurant:
        return api_error("NOT_FOUND", "QR код не найден", status=404)

    return api_success({"slug": table_obj.restaurant.slug, "table": table_obj.number})


@app.context_processor
def inject_lang():
    lang = getattr(g, "lang", DEFAULT_LANG)
    effective_role = None
    manager_restaurant_name = ""
    primary_restaurant_id = None
    if current_user.is_authenticated:
        user_restaurants = get_user_restaurants(current_user)
        if user_restaurants:
            primary_restaurant_id = user_restaurants[0].id
        if is_admin_user(current_user):
            effective_role = "admin"
        else:
            raw_role = getattr(current_user, "role", None)
            # If env no longer grants admin, fall back to owner instead of stale admin flag.
            if raw_role in {"admin", "superadmin"}:
                effective_role = "owner"
            else:
                effective_role = raw_role
        if effective_role == "manager":
            if user_restaurants:
                manager_restaurant_name = user_restaurants[0].translated_name(lang)
    else:
        pass
    return {
        "lang": lang,
        "languages": LANGUAGES,
        "default_lang": DEFAULT_LANG,
        "t": lambda key: translate_ui(key, lang),
        "t_menu": lambda key: translate_menu(key, lang),
        "is_admin": is_admin_user(current_user) if current_user.is_authenticated else False,
        "is_manager_only": is_manager_only(current_user) if current_user.is_authenticated else False,
        "current_role_label": translate_role(effective_role, lang) if effective_role else "",
        "manager_restaurant_name": manager_restaurant_name,
        "primary_restaurant_id": primary_restaurant_id,
        "can_create_restaurants": (
            is_admin_user(current_user)
            or (current_user.is_authenticated and not is_manager_only(current_user))
        ),
    }


class RegistrationForm(FlaskForm):
    email = StringField("Email", validators=[DataRequired(), Email(), Length(max=120)])
    password = PasswordField("Пароль", validators=[DataRequired(), Length(min=8)])
    confirm = PasswordField("Подтверждение", validators=[DataRequired(), EqualTo("password")])

class PasswordChangeForm(FlaskForm):
    current_password = PasswordField("Текущий пароль", validators=[DataRequired()])
    new_password = PasswordField("Новый пароль", validators=[DataRequired(), Length(min=8)])
    confirm_new_password = PasswordField("Подтверждение", validators=[DataRequired(), EqualTo("new_password")])


class LoginForm(FlaskForm):
    identifier = StringField("Email или логин", validators=[DataRequired(), Length(max=120)])
    password = PasswordField("Пароль", validators=[DataRequired()])


class RestaurantForm(FlaskForm):
    name = StringField("Название", validators=[DataRequired(), Length(max=150)])
    description = TextAreaField("Описание", validators=[Length(max=1000)])
    logo = FileField("Логотип (PNG/JPG)")
    theme = SelectField(
        "Тема меню",
        choices=[("classic", "Classic"), ("dark", "Dark"), ("modern", "Modern"), ("mental", "Mental")],
        default="classic",
    )
    menu_font = SelectField(
        "Шрифт меню",
        choices=[("serif", "Serif"), ("sans", "Sans"), ("display", "Display")],
        default="serif",
    )


class CategoryForm(FlaskForm):
    name = StringField("Название", validators=[DataRequired(), Length(max=120)])
    sort_order = IntegerField("Порядок", default=0, validators=[NumberRange(min=0, max=999)])
    icon_name = SelectField("Иконка категории", choices=CATEGORY_ICON_CHOICES, default="")


class DishForm(FlaskForm):
    name = StringField("Название", validators=[DataRequired(), Length(max=150)])
    description = TextAreaField("Описание", validators=[Length(max=1000)])
    price = DecimalField("Цена", validators=[DataRequired(), NumberRange(min=0)], places=2)
    available = BooleanField("В наличии", default=True)
    is_spicy = BooleanField("Острое")
    is_vegan = BooleanField("Веганское")
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
    spa = try_serve_react_index()
    if spa is not None:
        return spa
    if current_user.is_authenticated:
        if is_manager_only(current_user):
            return redirect(url_for("dashboard_call_waiter"))
        return redirect(url_for("dashboard"))
    return redirect(url_for("login"))


@app.route("/register", methods=["GET", "POST"])
def register():
    spa = try_serve_react_index()
    if spa is not None and request.method == "GET":
        return spa
    if current_user.is_authenticated:
        return redirect(url_for("dashboard"))
    form = RegistrationForm()
    if form.validate_on_submit():
        existing = User.query.filter_by(email=form.email.data.lower()).first()
        if existing:
            flash_t("user_exists", "warning")
        else:
            if not is_strong_password(form.password.data):
                flash_t("password_requirements", "warning")
                return render_template("auth/register.html", form=form)
            user = User(email=form.email.data.lower())
            user.username = unique_username(form.email.data.split("@")[0])
            user.set_password(form.password.data)
            user.role = "admin" if user.email.lower() in ADMIN_EMAILS else "owner"
            db.session.add(user)
            db.session.commit()
            flash_t("account_created", "success")
            return redirect(url_for("login"))
    return render_template("auth/register.html", form=form)


@app.route("/login", methods=["GET", "POST"])
def login():
    spa = try_serve_react_index()
    if spa is not None and request.method == "GET":
        return spa
    if current_user.is_authenticated:
        return redirect("/admin" if react_build_exists() else url_for("dashboard"))
    form = LoginForm()
    if form.validate_on_submit():
        identifier = (form.identifier.data or "").strip().lower()
        login_with_username = "@" not in identifier
        user = (
            User.query.filter_by(username=identifier).first()
            if login_with_username
            else User.query.filter_by(email=identifier).first()
        )
        if not user or not user.check_password(form.password.data):
            flash_t("bad_credentials", "danger")
        elif getattr(user, "is_blocked", False):
            flash_t("user_blocked_login", "danger")
        else:
            if not is_admin_user(user):
                desired_role = "manager" if login_with_username else "owner"
                if user.role != desired_role:
                    user.role = desired_role
                    db.session.commit()
            login_user(user)
            return redirect("/admin" if react_build_exists() else url_for("dashboard"))
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
    if is_manager_only(current_user):
        return redirect(url_for("dashboard_call_waiter"))
    restaurants = get_user_restaurants(current_user)
    managers_by_rest = build_restaurant_managers(restaurants)
    return render_template(
        "dashboard/restaurants_page.html",
        restaurants=restaurants,
        managers_by_rest=managers_by_rest,
        active_page="restaurants",
        body_class="dashboard-page",
    )


@app.route("/dashboard/call-waiter")
@login_required
def dashboard_call_waiter():
    requests = (
        CallRequest.query.join(Restaurant)
        .filter(Restaurant.user_id == current_user.id)
        .order_by(CallRequest.created_at.desc())
        .limit(50)
        .all()
    )
    restaurants = get_user_restaurants(current_user)
    _, tables_by_rest = build_restaurant_collections(restaurants)
    requests_data = [r.as_dict() for r in requests]
    new_requests_data = [r for r in requests_data if r.get("status") == "new"]
    lang = getattr(g, "lang", DEFAULT_LANG)
    status_labels = {
        "new": translate_ui("status_new", lang),
        "seen": translate_ui("status_seen", lang),
        "delivered": translate_ui("status_delivered", lang),
        "canceled": translate_ui("status_canceled", lang),
    }
    return render_template(
        "dashboard/call_waiter_page.html",
        requests=requests_data,
        new_requests=new_requests_data,
        status_labels=status_labels,
        restaurants=restaurants,
        tables_by_rest=tables_by_rest,
        active_page="call_waiter",
        body_class="dashboard-page",
    )


@app.route("/dashboard/call-waiter/history")
@login_required
def dashboard_call_waiter_history():
    requests = (
        CallRequest.query.join(Restaurant)
        .filter(Restaurant.user_id == current_user.id)
        .order_by(CallRequest.created_at.desc())
        .limit(50)
        .all()
    )
    requests_data = [r.as_dict() for r in requests]
    lang = getattr(g, "lang", DEFAULT_LANG)
    status_labels = {
        "new": translate_ui("status_new", lang),
        "seen": translate_ui("status_seen", lang),
        "delivered": translate_ui("status_delivered", lang),
        "canceled": translate_ui("status_canceled", lang),
    }
    new_requests_data = [r for r in requests_data if r.get("status") == "new"]
    return render_template(
        "dashboard/call_waiter_history_page.html",
        requests=requests_data,
        new_requests=new_requests_data,
        status_labels=status_labels,
        active_page="call_waiter_history",
        body_class="dashboard-page",
    )


@app.route("/dashboard/categories")
@login_required
def dashboard_categories():
    restaurants = get_user_restaurants(current_user)
    categories_by_rest, tables_by_rest = build_restaurant_collections(restaurants)
    return render_template(
        "dashboard/categories_page.html",
        restaurants=restaurants,
        categories_by_rest=categories_by_rest,
        tables_by_rest=tables_by_rest,
        active_page="categories",
        body_class="dashboard-page",
    )


@app.route("/dashboard/tables")
@login_required
def dashboard_tables():
    restaurants = get_user_restaurants(current_user)
    categories_by_rest, tables_by_rest = build_restaurant_collections(restaurants)
    return render_template(
        "dashboard/tables_page.html",
        restaurants=restaurants,
        categories_by_rest=categories_by_rest,
        tables_by_rest=tables_by_rest,
        active_page="tables",
        body_class="dashboard-page",
    )


@app.route("/dashboard/managers")
@login_required
def dashboard_managers():
    restaurants = get_user_restaurants(current_user)
    managers_by_rest = build_restaurant_managers(restaurants)
    return render_template(
        "dashboard/managers_page.html",
        restaurants=restaurants,
        managers_by_rest=managers_by_rest,
        active_page="managers",
        body_class="dashboard-page",
    )


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
    return api_success({"requests": [r.as_dict() for r in requests]})


@app.route("/api/call_requests/<int:req_id>/seen", methods=["POST"])
@login_required
def api_mark_request_seen(req_id: int):
    req = db.session.get(CallRequest, req_id)
    if not req or not has_restaurant_access(req.restaurant):
        abort(404)
    req.status = "seen"
    db.session.commit()
    return api_success({"ok": True})


@app.route("/api/call_requests/<int:req_id>/status", methods=["POST"])
@login_required
def api_update_request_status(req_id: int):
    req = db.session.get(CallRequest, req_id)
    if not req or not has_restaurant_access(req.restaurant):
        abort(404)
    data = request.get_json(silent=True) or {}
    status = data.get("status")
    if status not in REQUEST_STATUS_SET:
        abort(400)
    req.status = status
    db.session.commit()
    return api_success({"ok": True})


@app.route("/legacy/admin/users")
@login_required
@admin_required
def admin_users():
    users = User.query.order_by(User.email).all()
    restaurants_by_user: dict[int, list[Restaurant]] = {}
    for r in Restaurant.query.order_by(Restaurant.user_id, Restaurant.name).all():
        restaurants_by_user.setdefault(r.user_id, []).append(r)
    all_restaurants = [r for rest_list in restaurants_by_user.values() for r in rest_list]
    managers_by_rest = build_restaurant_managers(all_restaurants)
    return render_template(
        "admin_users.html",
        users=users,
        restaurants_by_user=restaurants_by_user,
        managers_by_rest=managers_by_rest,
        admin_emails=ADMIN_EMAILS,
    )


@app.route("/legacy/admin/restaurants")
@login_required
@admin_required
def admin_restaurants():
    restaurants = Restaurant.query.order_by(Restaurant.name).all()
    return render_template("admin_restaurants.html", restaurants=restaurants)


def _delete_restaurant_with_children(restaurant: Restaurant) -> bool:
    """Hard-delete restaurant and dependent rows to satisfy strict FK constraints."""
    try:
        db.session.execute(text("DELETE FROM `call_request` WHERE restaurant_id = :rid"), {"rid": restaurant.id})
        db.session.execute(
            text(
                "DELETE d FROM `dish` d "
                "JOIN `category` c ON d.category_id = c.id "
                "WHERE c.restaurant_id = :rid"
            ),
            {"rid": restaurant.id},
        )
        db.session.execute(text("DELETE FROM `category` WHERE restaurant_id = :rid"), {"rid": restaurant.id})
        # Some legacy DBs use `table`; current models use `restaurant_tables`
        db.session.execute(text("DELETE FROM `table` WHERE restaurant_id = :rid"), {"rid": restaurant.id})
        db.session.execute(text("DELETE FROM `restaurant_tables` WHERE restaurant_id = :rid"), {"rid": restaurant.id})
        db.session.delete(restaurant)
        db.session.commit()
        return True
    except IntegrityError:
        db.session.rollback()
        return False


@app.route("/admin/restaurants/<int:restaurant_id>/delete", methods=["POST"])
@login_required
def admin_delete_restaurant(restaurant_id: int):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or not is_admin_user(current_user):
        abort(404)
    if _delete_restaurant_with_children(restaurant):
        flash_t("restaurant_deleted", "info")
    else:
        flash_t("restaurant_delete_failed", "danger")
    return redirect(request.referrer or url_for("admin_users"))


@app.route("/restaurants/<int:restaurant_id>/delete", methods=["POST"])
@login_required
def delete_restaurant(restaurant_id: int):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant:
        abort(404)
    if not (restaurant.owner == current_user or is_admin_user(current_user)):
        abort(403)
    if _delete_restaurant_with_children(restaurant):
        flash_t("restaurant_deleted", "info")
    else:
        flash_t("restaurant_delete_failed", "danger")
    return redirect(url_for("dashboard"))


@app.route("/restaurants/new", methods=["GET", "POST"])
@login_required
def create_restaurant():
    if is_manager_only(current_user) and not is_admin_user(current_user):
        abort(403)
    form = RestaurantForm()
    translation_values = build_translation_context(None)
    if form.validate_on_submit():
        logo_filename = save_file(form.logo.data, LOGO_FOLDER)
        name_translations_raw = extract_translation_submission("name")
        desc_translations_raw = extract_translation_submission("description")
        restaurant = Restaurant(
            name=form.name.data,
            description=form.description.data,
            theme=form.theme.data or "classic",
            menu_font=form.menu_font.data or "serif",
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
    if not has_restaurant_access(restaurant):
        abort(404)
    return restaurant


@app.route("/restaurants/<int:restaurant_id>/edit", methods=["GET", "POST"])
@login_required
def edit_restaurant(restaurant_id: int):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or (restaurant.owner != current_user and not is_admin_user(current_user)):
        abort(403)
    form = RestaurantForm(obj=restaurant)
    translation_values = build_translation_context(restaurant)
    if form.validate_on_submit():
        restaurant.name = form.name.data
        restaurant.description = form.description.data
        restaurant.theme = form.theme.data or restaurant.theme or "classic"
        restaurant.menu_font = form.menu_font.data or restaurant.menu_font or "serif"
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
    categories = Category.query.filter_by(restaurant_id=restaurant.id).order_by(Category.name.asc()).all()
    tables = DiningTable.query.filter_by(restaurant_id=restaurant.id).order_by(DiningTable.number).all()
    dish_forms = {cat.id: DishForm() for cat in categories}
    return render_template(
        "restaurant_manage.html",
        restaurant=restaurant,
        categories=categories,
        tables=tables,
        dish_forms=dish_forms,
        active_page="categories",
    )


@app.route("/restaurants/<int:restaurant_id>/categories/new", methods=["GET", "POST"])
@login_required
def create_category(restaurant_id: int):
    restaurant = require_restaurant_owned(restaurant_id)
    form = CategoryForm()
    if form.validate_on_submit():
        category = Category(
            name=form.name.data,
            sort_order=form.sort_order.data or 0,
            icon_name=form.icon_name.data or None,
            restaurant=restaurant,
        )
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
    if not category or not has_restaurant_access(category.restaurant):
        abort(404)
    form = CategoryForm(obj=category)
    if form.validate_on_submit():
        category.name = form.name.data
        category.sort_order = form.sort_order.data or 0
        category.icon_name = form.icon_name.data or None
        populate_translations_for_category(category)
        db.session.commit()
        flash_t("category_updated", "success")
        return redirect(url_for("manage_restaurant", restaurant_id=category.restaurant.id))
    return render_template("category_form.html", form=form, restaurant=category.restaurant)


@app.route("/categories/<int:category_id>/delete", methods=["POST"])
@login_required
def delete_category(category_id: int):
    category = db.session.get(Category, category_id)
    if not category or not has_restaurant_access(category.restaurant):
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
    if not category or not has_restaurant_access(category.restaurant):
        abort(404)
    form = DishForm()
    if form.validate_on_submit():
        image_filename = save_file(form.image.data, DISH_FOLDER)
        dish = Dish(
            name=form.name.data,
            description=form.description.data,
            price=form.price.data,
            available=form.available.data,
            is_spicy=form.is_spicy.data,
            is_vegan=form.is_vegan.data,
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
    if not dish or not has_restaurant_access(dish.category.restaurant):
        abort(404)
    form = DishForm(obj=dish)
    if form.validate_on_submit():
        dish.name = form.name.data
        dish.description = form.description.data
        dish.price = form.price.data
        dish.available = form.available.data
        dish.is_spicy = form.is_spicy.data
        dish.is_vegan = form.is_vegan.data
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
    if not dish or not has_restaurant_access(dish.category.restaurant):
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


@app.route("/restaurants/<int:restaurant_id>/collaborators", methods=["POST"])
@login_required
def add_collaborator(restaurant_id: int):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or (restaurant.owner != current_user and not is_admin_user(current_user)):
        abort(403)
    username_input = (request.form.get("username") or "").strip()
    password = (request.form.get("password") or "").strip()
    if not username_input or not password:
        flash_t("collaborator_missing_fields", "warning")
        return redirect(request.referrer or url_for("dashboard"))
    if len(password) < 8:
        flash_t("password_too_short", "warning")
        return redirect(request.referrer or url_for("dashboard"))
    if not is_strong_password(password):
        flash_t("password_requirements", "warning")
        return redirect(request.referrer or url_for("dashboard"))
    if contains_restaurant_hint(password, restaurant):
        flash_t("password_no_restaurant", "warning")
        return redirect(request.referrer or url_for("dashboard"))
    desired_username = sanitize_username(username_input)
    if not desired_username:
        flash_t("collaborator_missing_fields", "warning")
        return redirect(request.referrer or url_for("dashboard"))
    user = User.query.filter_by(username=desired_username).first()
    if not user:
        final_username = unique_username(desired_username)
        user = User(username=final_username, email=generate_manager_email(final_username, restaurant))
        user.set_password(password)
        user.role = "manager"
        db.session.add(user)
        db.session.flush()
    else:
        if not is_admin_user(user):
            user.role = "manager"
        if not user.username:
            user.username = unique_username(desired_username)
        user.set_password(password)
    existing = RestaurantUser.query.filter_by(restaurant_id=restaurant.id, user_id=user.id).first()
    if existing:
        flash_t("collaborator_exists", "info")
    else:
        link = RestaurantUser(restaurant_id=restaurant.id, user_id=user.id, role="manager")
        db.session.add(link)
        flash_t("collaborator_added", "success")
    db.session.commit()
    return redirect(request.referrer or url_for("dashboard"))


@app.route("/admin/collaborators/<int:link_id>/delete", methods=["POST"])
@login_required
def admin_remove_collaborator(link_id: int):
    link = db.session.get(RestaurantUser, link_id)
    if not link:
        abort(404)
    restaurant = db.session.get(Restaurant, link.restaurant_id)
    if not (is_admin_user(current_user) or (restaurant and restaurant.owner == current_user)):
        abort(403)
    db.session.delete(link)
    db.session.commit()
    flash_t("collaborator_removed", "info")
    return redirect(request.referrer or url_for("dashboard"))


@app.route("/admin/users/<int:user_id>/password", methods=["POST"])
@login_required
@admin_required
def admin_reset_user_password(user_id: int):
    user = db.session.get(User, user_id)
    if not user:
        abort(404)
    new_password = (request.form.get("password") or "").strip()
    if not new_password or len(new_password) < 8:
        flash_t("password_too_short", "warning")
        return redirect(request.referrer or url_for("admin_users"))
    if not is_strong_password(new_password):
        flash_t("password_requirements", "warning")
        return redirect(request.referrer or url_for("admin_users"))
    user.set_password(new_password)
    db.session.commit()
    flash_t("password_updated", "success")
    return redirect(request.referrer or url_for("admin_users"))


@app.route("/admin/users/<int:user_id>/block", methods=["POST"])
@login_required
@admin_required
def admin_toggle_user_block(user_id: int):
    user = db.session.get(User, user_id)
    if not user:
        abort(404)
    if user.id == current_user.id or is_admin_user(user):
        flash_t("cannot_block_admin", "warning")
        return redirect(request.referrer or url_for("admin_users"))
    action = (request.form.get("action") or "block").lower()
    block = action != "unblock"
    user.is_blocked = block
    db.session.commit()
    flash_t("user_blocked" if block else "user_unblocked", "info")
    return redirect(request.referrer or url_for("admin_users"))


@app.route("/admin/users/<int:user_id>/delete", methods=["POST"])
@login_required
@admin_required
def admin_delete_user(user_id: int):
    user = db.session.get(User, user_id)
    if not user:
        abort(404)
    if user.id == current_user.id or (getattr(user, "email", "").lower() in ADMIN_EMAILS):
        flash("Cannot delete this user", "warning")
        return redirect(request.referrer or url_for("admin_users"))
    try:
        # Remove restaurants owned by the user
        restaurants = Restaurant.query.filter_by(user_id=user.id).all()
        for r in restaurants:
            _delete_restaurant_with_children(r)
        # Remove manager links
        RestaurantUser.query.filter_by(user_id=user.id).delete(synchronize_session=False)
        db.session.delete(user)
        db.session.commit()
        flash("User deleted", "info")
    except Exception:
        db.session.rollback()
        flash("Failed to delete user", "danger")
    return redirect(request.referrer or url_for("admin_users"))


@app.route("/tables/<int:table_id>/status", methods=["POST"])
@login_required
def update_table_status(table_id: int):
    table = db.session.get(DiningTable, table_id)
    if not table or not has_restaurant_access(table.restaurant):
        abort(404)
    status = (request.form.get("status") or "").lower()
    table.is_occupied = status == "occupied"
    db.session.commit()
    flash_t("table_marked_occupied" if table.is_occupied else "table_marked_free", "success")
    # Keep the user on whichever page initiated the change; default to call-waiter.
    return redirect(request.referrer or url_for("dashboard_call_waiter"))


@app.route("/tables/<int:table_id>/delete", methods=["POST"])
@login_required
def delete_table(table_id: int):
    table = db.session.get(DiningTable, table_id)
    if not table or not has_restaurant_access(table.restaurant):
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
    if not table or not has_restaurant_access(table.restaurant):
        abort(404)
    menu_url = url_for("public_menu", slug=table.restaurant.slug, table=table.number, _external=True)
    qr_path = QR_FOLDER / f"table_{table.id}.png"
    img = qrcode.make(menu_url)
    img.save(qr_path)
    qr_filename = str(qr_path.relative_to(UPLOAD_ROOT))
    return render_template("qr_page.html", restaurant=table.restaurant, menu_url=menu_url, qr_filename=qr_filename)


@app.route("/menu/<slug>/")
def public_menu(slug: str):
    if react_build_exists():
        table_number = api_parse_int(request.args.get("table"))
        if table_number:
            return redirect(f"/r/{slug}/table/{table_number}")
        return redirect(f"/r/{slug}")
    restaurant = Restaurant.query.filter_by(slug=slug).first_or_404()
    table_param = request.args.get("table")
    active_table_number = None
    if table_param:
        try:
            table_value = int(table_param)
            table_obj = DiningTable.query.filter_by(restaurant_id=restaurant.id, number=table_value).first()
            if table_obj and table_obj.is_occupied:
                active_table_number = table_obj.number
        except Exception:
            active_table_number = None
    categories = (
        Category.query.filter_by(restaurant_id=restaurant.id).order_by(Category.sort_order, Category.name).all()
    )
    return render_template(
        "public_menu.html",
        restaurant=restaurant,
        categories=categories,
        table_number=active_table_number,
    )


@app.route("/api/call_waiter", methods=["POST"])
def api_call_waiter():
    data = request.get_json(silent=True) or {}
    slug = (data.get("slug") or "").strip()
    table = data.get("table")
    items = data.get("items", [])
    if not slug or table is None:
        return api_error("VALIDATION_ERROR", "Нужно указать slug и table", status=400)
    restaurant = Restaurant.query.filter_by(slug=slug).first()
    if not restaurant:
        return api_error("NOT_FOUND", "Ресторан не найден", status=404)
    table_number = api_parse_int(table)
    if not table_number:
        return api_error("VALIDATION_ERROR", "Некорректный table", status=400)
    req = CallRequest(restaurant_id=restaurant.id, table_number=table_number, items=items)
    db.session.add(req)
    db.session.commit()
    return api_success({"ok": True}, status=201)


@app.route("/set-lang")
def set_lang():
    lang = request.args.get("lang")
    if lang in LANGUAGES:
        session["lang"] = lang
    ref = request.referrer or url_for("home")
    return redirect(ref)


@app.route("/app/")
@app.route("/app/<path:path>")
def react_spa(path: str = ""):
    return serve_react_index_or_404()


@app.route("/admin")
@app.route("/admin/<path:path>")
def react_admin(path: str = ""):
    return serve_react_index_or_404()


@app.route("/qr")
@app.route("/qr/<path:path>")
def react_qr(path: str = ""):
    return serve_react_index_or_404()


@app.route("/r")
@app.route("/r/<path:path>")
def react_public(path: str = ""):
    return serve_react_index_or_404()


def react_build_exists() -> bool:
    react_dir = BASE_DIR / "static" / "react"
    return (react_dir / "index.html").is_file()


def try_serve_react_index():
    """Return index.html for SPA routes, or None if build missing / not HTML request."""
    if not react_build_exists():
        return None
    if request.method not in {"GET", "HEAD"}:
        return None
    accept = (request.headers.get("Accept") or "").lower()
    if "text/html" not in accept and "*/*" not in accept:
        return None
    react_dir = BASE_DIR / "static" / "react"
    return send_from_directory(str(react_dir), "index.html")


def serve_react_index_or_404():
    resp = try_serve_react_index()
    if resp is not None:
        return resp
    return "React build not found. Run: cd frontend && npm run build", 404


with app.app_context():
    # Backward compat: if an old "theme" table exists, rename it to "themes".
    try:
        inspector_pre = inspect(db.engine)
        if inspector_pre.has_table("theme") and not inspector_pre.has_table("themes"):
            with db.engine.begin() as conn:
                dialect = db.engine.dialect.name
                if dialect == "mysql":
                    conn.execute(text("RENAME TABLE theme TO themes"))
                else:
                    conn.execute(text("ALTER TABLE theme RENAME TO themes"))
    except Exception:
        pass

    db.create_all()
    # Ensure new optional columns exist for theme and menu font (safe for SQLite/MySQL)
    inspector = inspect(db.engine)
    columns = {col["name"] for col in inspector.get_columns("restaurant")} if inspector.has_table("restaurant") else set()
    with db.engine.begin() as conn:
        if "theme" not in columns:
            try:
                conn.execute(text("ALTER TABLE restaurant ADD COLUMN theme VARCHAR(32)"))
            except Exception:
                pass
        if "menu_font" not in columns:
            try:
                conn.execute(text("ALTER TABLE restaurant ADD COLUMN menu_font VARCHAR(255)"))
            except Exception:
                pass
        else:
            # If previously created as VARCHAR(32), widen to store uploaded font paths.
            try:
                dialect = db.engine.dialect.name
                if dialect == "mysql":
                    conn.execute(text("ALTER TABLE restaurant MODIFY COLUMN menu_font VARCHAR(255)"))
                elif dialect == "postgresql":
                    conn.execute(text("ALTER TABLE restaurant ALTER COLUMN menu_font TYPE VARCHAR(255)"))
            except Exception:
                pass
        if "phone" not in columns:
            try:
                conn.execute(text("ALTER TABLE restaurant ADD COLUMN phone VARCHAR(40)"))
            except Exception:
                pass
        if "whatsapp" not in columns:
            try:
                conn.execute(text("ALTER TABLE restaurant ADD COLUMN whatsapp VARCHAR(40)"))
            except Exception:
                pass
        if "instagram" not in columns:
            try:
                conn.execute(text("ALTER TABLE restaurant ADD COLUMN instagram VARCHAR(255)"))
            except Exception:
                pass
        if "facebook" not in columns:
            try:
                conn.execute(text("ALTER TABLE restaurant ADD COLUMN facebook VARCHAR(255)"))
            except Exception:
                pass
        if "menu_font_size" not in columns:
            try:
                conn.execute(text("ALTER TABLE restaurant ADD COLUMN menu_font_size INTEGER"))
            except Exception:
                pass
        if "menu_font_brand" not in columns:
            try:
                conn.execute(text("ALTER TABLE restaurant ADD COLUMN menu_font_brand VARCHAR(255)"))
            except Exception:
                pass
        if "menu_font_brand_size" not in columns:
            try:
                conn.execute(text("ALTER TABLE restaurant ADD COLUMN menu_font_brand_size INTEGER"))
            except Exception:
                pass
        if "menu_font_category" not in columns:
            try:
                conn.execute(text("ALTER TABLE restaurant ADD COLUMN menu_font_category VARCHAR(255)"))
            except Exception:
                pass
        if "menu_font_category_size" not in columns:
            try:
                conn.execute(text("ALTER TABLE restaurant ADD COLUMN menu_font_category_size INTEGER"))
            except Exception:
                pass
        if "menu_font_item" not in columns:
            try:
                conn.execute(text("ALTER TABLE restaurant ADD COLUMN menu_font_item VARCHAR(255)"))
            except Exception:
                pass
        if "menu_font_item_size" not in columns:
            try:
                conn.execute(text("ALTER TABLE restaurant ADD COLUMN menu_font_item_size INTEGER"))
            except Exception:
                pass
        if "loading_image_path" not in columns:
            try:
                conn.execute(text("ALTER TABLE restaurant ADD COLUMN loading_image_path VARCHAR(255)"))
            except Exception:
                pass
        if "loading_style" not in columns:
            try:
                conn.execute(text("ALTER TABLE restaurant ADD COLUMN loading_style VARCHAR(32)"))
            except Exception:
                pass
        if "theme_id" not in columns:
            try:
                conn.execute(text("ALTER TABLE restaurant ADD COLUMN theme_id INTEGER"))
            except Exception:
                pass
        if "theme_overrides_json" not in columns:
            try:
                dialect = db.engine.dialect.name
                if dialect == "mysql":
                    conn.execute(text("ALTER TABLE restaurant ADD COLUMN theme_overrides_json JSON"))
                else:
                    conn.execute(text("ALTER TABLE restaurant ADD COLUMN theme_overrides_json TEXT"))
            except Exception:
                pass
        if "header_style_json" not in columns:
            try:
                dialect = db.engine.dialect.name
                if dialect == "mysql":
                    conn.execute(text("ALTER TABLE restaurant ADD COLUMN header_style_json JSON"))
                else:
                    conn.execute(text("ALTER TABLE restaurant ADD COLUMN header_style_json TEXT"))
            except Exception:
                pass
        if "hero_preset_id" not in columns:
            try:
                conn.execute(text("ALTER TABLE restaurant ADD COLUMN hero_preset_id INTEGER"))
            except Exception:
                pass
        if "hero_overrides_json" not in columns:
            try:
                dialect = db.engine.dialect.name
                if dialect == "mysql":
                    conn.execute(text("ALTER TABLE restaurant ADD COLUMN hero_overrides_json JSON"))
                else:
                    conn.execute(text("ALTER TABLE restaurant ADD COLUMN hero_overrides_json TEXT"))
            except Exception:
                pass
        if "menu_card_preset_id" not in columns:
            try:
                conn.execute(text("ALTER TABLE restaurant ADD COLUMN menu_card_preset_id INTEGER"))
            except Exception:
                pass
        if "menu_card_overrides_json" not in columns:
            try:
                dialect = db.engine.dialect.name
                if dialect == "mysql":
                    conn.execute(text("ALTER TABLE restaurant ADD COLUMN menu_card_overrides_json JSON"))
                else:
                    conn.execute(text("ALTER TABLE restaurant ADD COLUMN menu_card_overrides_json TEXT"))
            except Exception:
                pass
        if "menu_card_remove_bg_on_upload" not in columns:
            try:
                dialect = db.engine.dialect.name
                if dialect == "mysql":
                    conn.execute(text("ALTER TABLE restaurant ADD COLUMN menu_card_remove_bg_on_upload BOOLEAN"))
                else:
                    conn.execute(text("ALTER TABLE restaurant ADD COLUMN menu_card_remove_bg_on_upload INTEGER"))
            except Exception:
                pass
    category_columns = {col["name"] for col in inspector.get_columns("category")} if inspector.has_table("category") else set()
    if "icon_name" not in category_columns and inspector.has_table("category"):
        try:
            with db.engine.begin() as conn:
                conn.execute(text("ALTER TABLE category ADD COLUMN icon_name VARCHAR(64)"))
        except Exception:
            pass
    if "image_path" not in category_columns and inspector.has_table("category"):
        try:
            with db.engine.begin() as conn:
                conn.execute(text("ALTER TABLE category ADD COLUMN image_path VARCHAR(255)"))
        except Exception:
            pass
    if "header_style_json" not in category_columns and inspector.has_table("category"):
        try:
            with db.engine.begin() as conn:
                dialect = db.engine.dialect.name
                if dialect == "mysql":
                    conn.execute(text("ALTER TABLE category ADD COLUMN header_style_json JSON"))
                else:
                    conn.execute(text("ALTER TABLE category ADD COLUMN header_style_json TEXT"))
        except Exception:
            pass

    dish_columns = {col["name"] for col in inspector.get_columns("dish")} if inspector.has_table("dish") else set()
    if inspector.has_table("dish"):
        try:
            with db.engine.begin() as conn:
                if "image_variants_json" not in dish_columns:
                    dialect = db.engine.dialect.name
                    if dialect == "mysql":
                        conn.execute(text("ALTER TABLE dish ADD COLUMN image_variants_json JSON"))
                    else:
                        conn.execute(text("ALTER TABLE dish ADD COLUMN image_variants_json TEXT"))
                if "processed_image_filename" not in dish_columns:
                    conn.execute(text("ALTER TABLE dish ADD COLUMN processed_image_filename VARCHAR(255)"))
                if "processed_image_variants_json" not in dish_columns:
                    dialect = db.engine.dialect.name
                    if dialect == "mysql":
                        conn.execute(text("ALTER TABLE dish ADD COLUMN processed_image_variants_json JSON"))
                    else:
                        conn.execute(text("ALTER TABLE dish ADD COLUMN processed_image_variants_json TEXT"))
                if "image_remove_bg_status" not in dish_columns:
                    conn.execute(text("ALTER TABLE dish ADD COLUMN image_remove_bg_status VARCHAR(32)"))
                if "image_remove_bg_error" not in dish_columns:
                    conn.execute(text("ALTER TABLE dish ADD COLUMN image_remove_bg_error VARCHAR(255)"))
                if "use_processed_image" not in dish_columns:
                    dialect = db.engine.dialect.name
                    if dialect == "mysql":
                        conn.execute(text("ALTER TABLE dish ADD COLUMN use_processed_image BOOLEAN"))
                    else:
                        conn.execute(text("ALTER TABLE dish ADD COLUMN use_processed_image INTEGER"))
        except Exception:
            pass

    # Seed built-in themes and assign default theme_id where missing.
    try:
        for preset_key, preset in THEME_PRESETS.items():
            existing = Theme.query.filter_by(preset_key=preset_key).first()
            if existing:
                continue
            theme = Theme(
                name=preset.get("name") or preset_key,
                preset_key=preset_key,
                config_json={
                    "vars": preset.get("vars") or {},
                    "category_layout": preset.get("category_layout") or "pills",
                    "transition": preset.get("transition") or "slide",
                    "card_style": preset.get("card_style") or "glass",
                },
            )
            db.session.add(theme)
        db.session.commit()
    except Exception:
        db.session.rollback()

    try:
        default_theme = Theme.query.filter_by(preset_key=DEFAULT_THEME_PRESET).first()
        if default_theme:
            # Only set theme_id if it's NULL (keep compatibility with existing restaurants).
            Restaurant.query.filter(or_(Restaurant.theme_id.is_(None), Restaurant.theme_id == 0)).update(
                {"theme_id": default_theme.id},
                synchronize_session=False,
            )
            db.session.commit()
    except Exception:
        db.session.rollback()

    # Seed built-in hero presets and assign default hero_preset_id where missing.
    try:
        for preset_key, preset in HERO_PRESETS.items():
            existing = HeroPreset.query.filter_by(key=preset_key).first()
            if existing:
                continue
            row = HeroPreset(
                name=preset.get("name") or preset_key,
                key=preset_key,
                is_builtin=True,
                config_json=preset.get("config_json") or {},
            )
            db.session.add(row)
        db.session.commit()
    except Exception:
        db.session.rollback()

    try:
        default_hero = HeroPreset.query.filter_by(key=DEFAULT_HERO_PRESET_KEY).first()
        if default_hero:
            Restaurant.query.filter(or_(Restaurant.hero_preset_id.is_(None), Restaurant.hero_preset_id == 0)).update(
                {"hero_preset_id": default_hero.id},
                synchronize_session=False,
            )
            db.session.commit()
    except Exception:
        db.session.rollback()

    # Seed built-in menu card presets and assign default menu_card_preset_id where missing.
    try:
        for preset_key, preset in MENU_CARD_PRESETS.items():
            existing = MenuCardPreset.query.filter_by(key=preset_key).first()
            if existing:
                continue
            row = MenuCardPreset(
                name=preset.get("name") or preset_key,
                key=preset_key,
                is_builtin=True,
                config_json=sanitize_menu_card_config(preset.get("config_json") or {}, strict=False)[0],
            )
            db.session.add(row)
        db.session.commit()
    except Exception:
        db.session.rollback()

    try:
        default_card = MenuCardPreset.query.filter_by(key=DEFAULT_MENU_CARD_PRESET_KEY).first()
        if default_card:
            Restaurant.query.filter(or_(Restaurant.menu_card_preset_id.is_(None), Restaurant.menu_card_preset_id == 0)).update(
                {"menu_card_preset_id": default_card.id},
                synchronize_session=False,
            )
            db.session.commit()
    except Exception:
        db.session.rollback()


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
