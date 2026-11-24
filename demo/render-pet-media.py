"""Render demo artwork from the portfolio descriptions and square monograms."""
import hashlib
import json
import re
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent
palette = ["#235B9D", "#6B489D", "#08756E", "#8B492C", "#86466D", "#315B47"]


def read(name):
    return json.loads((root / "data" / (name + ".json")).read_text(encoding="utf-8"))


def font(size, bold=False):
    return ImageFont.truetype("arialbd.ttf" if bold else "arial.ttf", size)


def label(draw, position, value, size, color="#172941", bold=False):
    draw.text(position, value, font=font(size, bold), fill=color, anchor="lt")


def fitted(draw, position, value, size, width, color):
    while draw.textlength(value, font=font(size, True)) > width:
        size -= 1
    label(draw, position, value, size, color, True)


def render_avatar(company):
    source = root / "assets" / "logos" / (company["id"] + ".svg")
    if not source.exists():
        return
    colors = re.findall(r'fill="(#[0-9A-Fa-f]{6})"', source.read_text(encoding="utf-8"))
    if len(colors) < 2:
        return
    name = company["shortName"]
    words = re.findall(r"[\w]+", name)
    initials = "".join(word[0] for word in words[:2]) if len(words) > 1 else name[:2]
    image = Image.new("RGB", (400, 400), colors[1])
    draw = ImageDraw.Draw(image)
    draw.text((200, 200), initials.upper(), fill="white", font=font(158, True), anchor="mm")
    image.save(root / "assets" / "company-avatars" / (company["id"] + ".png"), optimize=True)


def render_project(project, index, folder):
    color = palette[index % len(palette)]
    title = project["title"]
    summary = project["shortDescription"]
    pictogram = title[:2].upper()
    cover = Image.new("RGB", (1280, 800), color)
    draw = ImageDraw.Draw(cover)
    draw.rounded_rectangle((852, 208, 1180, 548), radius=80, fill="#eff5ff")
    draw.text((1016, 378), pictogram, font=font(136, True), fill=color, anchor="mm")
    label(draw, (88, 143), "СТУДЕНЧЕСКИЙ PET-ПРОЕКТ", 25, "#e8f2ff", True)
    fitted(draw, (84, 255), title, 75, 730, "#ffffff")
    for row, line in enumerate(textwrap.wrap(summary, 42)):
        label(draw, (89, 390 + row * 47), line, 30, "#ffffff")
    cover.save(folder / (project["id"] + "-cover.png"), optimize=True)

    panels = [
        ("Основной сценарий", project["problemSolved"], summary),
        ("Что проверяет автор", project["direction"], project["fullDescription"].split("##")[-1].strip()),
    ]
    for image_index, (heading, first, second) in enumerate(panels, 1):
        image = Image.new("RGB", (1280, 800), "#edf3f9")
        draw = ImageDraw.Draw(image)
        draw.rectangle((0, 0, 322, 800), fill=color)
        fitted(draw, (37, 55), title, 37, 250, "#ffffff")
        label(draw, (37, 122), "Схема прототипа", 22, "#ffffff")
        label(draw, (378, 64), heading, 45, bold=True)
        for card, body in enumerate((first, second)):
            top = 166 + card * 276
            draw.rounded_rectangle((376, top, 1216, top + 234), radius=27, fill="#ffffff")
            draw.rounded_rectangle((412, top + 31, 456, top + 75), radius=12, fill=color)
            draw.text((434, top + 53), str(card + 1), font=font(21, True), fill="white", anchor="mm")
            for line_index, line in enumerate(textwrap.wrap(" ".join(body.split()), 49)[:5]):
                label(draw, (484, top + 39 + line_index * 36), line, 25)
        image.save(folder / (project["id"] + "-view-" + str(image_index) + ".png"), optimize=True)


folder = root / "assets" / "pet-media"
folder.mkdir(exist_ok=True)
for company in read("companies")[:24]:
    render_avatar(company)
projects = read("projects")
students = read("students")
pets = [project for project in projects if project["id"].startswith("syn_petproject_")]
with_pets = {
    project["authorId"] for project in pets
    if project["visibility"] == "public"
    and project["status"] != "архив"
    and project["moderationStatus"] != "pending"
}
catalog = root / "data" / "demo-pet-projects.json"
additional = json.loads(catalog.read_text(encoding="utf-8")) if catalog.exists() else []
with_pets.update(project["authorId"] for project in additional)
for index, student in enumerate(students):
    if student["id"] in with_pets:
        continue
    example = next((p for p in projects if p["authorId"] == student["id"]), projects[index % len(projects)])
    theme = example["title"].split("«")[-1].rstrip("»")
    profile = student["studentProfile"]
    additional.append({
        "id": f"syn_petextra_{index + 1:03}", "authorId": student["id"], "authorName": student["fullName"],
        "title": f"{theme}: тестовый стенд", "category": "pet-проект", "visibility": "public",
        "shortDescription": "Самостоятельный стенд для проверки сценариев и сравнения результатов прогона.",
        "problemSolved": example["problemSolved"], "direction": example["direction"],
        "technologies": profile["techStack"], "createdAt": f"2026-{6 + index % 5:02}-{1 + index % 24:02}",
        "fullDescription": "## Сценарий\n\n" + example["shortDescription"]
        + "\n\n## Проверка\n\nАвтор сравнил контрольные примеры, сохранил результаты прогона и описал поведение на неполном входе.",
        "moderationStatus": "approved", "status": "завершён", "screenshots": [],
    })
catalog.write_text(json.dumps(additional, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
other_pets = [project for project in projects if project["category"] == "pet-проект" and project not in pets]
for index, project in enumerate(pets + additional + other_pets):
    render_project(project, index, folder)
checksums = {hashlib.sha256(path.read_bytes()).digest() for path in folder.glob("*.png")}
assert len(checksums) == len(list(folder.glob("*.png"))), "Duplicate portfolio artwork"

certificates = root / "assets" / "demo-certificates"
certificates.mkdir(exist_ok=True)
for student in students:
    image = Image.new("RGB", (1200, 680), "#edf3f9")
    draw = ImageDraw.Draw(image)
    draw.rectangle((34, 34, 1166, 646), outline="#235b9d", width=4)
    label(draw, (91, 104), "ДЕМОНСТРАЦИОННАЯ ВИТРИНА", 26, "#235b9d", True)
    label(draw, (85, 185), "Сертификат проектной работы", 56, bold=True)
    label(draw, (89, 311), student["fullName"], 43, bold=True)
    label(draw, (91, 416), "Победитель учебной номинации за защиту проектной работы", 30)
    label(draw, (91, 535), "Учебный образец · осенний семестр 2026", 23, "#425674")
    image.save(certificates / (student["id"] + ".png"), optimize=True)
