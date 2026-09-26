import os
from PIL import Image, ImageDraw, ImageFilter

def generate_datanova_icon(output_ico_path, output_png_192, output_png_512):
    size = 512
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Background rounded shield / squircle
    margin = 24
    radius = 110
    
    # Outer dark obsidian background
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=radius,
        fill=(6, 13, 31, 255)
    )

    # Cyan/Indigo glowing gradient ring
    for i in range(12):
        alpha = int(180 - i * 12)
        color = (6, 182, 212, alpha) if i % 2 == 0 else (59, 130, 246, alpha)
        draw.rounded_rectangle(
            [margin + i, margin + i, size - margin - i, size - margin - i],
            radius=max(10, radius - i),
            outline=color,
            width=2
        )

    # 2. Futuristic Nova Robot Face / Quantum Star Emblem in center
    cx, cy = size // 2, size // 2 - 10

    # Antenna
    draw.line([(cx, cy - 130), (cx, cy - 80)], fill=(56, 189, 248, 255), width=8)
    draw.ellipse([cx - 16, cy - 150, cx + 16, cy - 118], fill=(6, 182, 212, 255), outline=(255, 255, 255, 255), width=3)

    # Robot Head Oval (Ceramic White / Silver)
    head_w, head_h = 170, 130
    draw.ellipse(
        [cx - head_w, cy - head_h, cx + head_w, cy + head_h],
        fill=(248, 250, 252, 255),
        outline=(59, 130, 246, 255),
        width=6
    )

    # Dark Cyber Visor Screen
    visor_w, visor_h = 135, 85
    draw.ellipse(
        [cx - visor_w, cy - visor_h + 10, cx + visor_w, cy + visor_h + 10],
        fill=(8, 14, 24, 255),
        outline=(14, 165, 233, 255),
        width=4
    )

    # Glowing Cyan Eyes
    eye_offset = 60
    eye_y = cy + 5
    eye_r = 22
    # Left Eye
    draw.ellipse(
        [cx - eye_offset - eye_r, eye_y - eye_r, cx - eye_offset + eye_r, eye_y + eye_r],
        fill=(6, 182, 212, 255)
    )
    draw.ellipse(
        [cx - eye_offset - 8, eye_y - 8, cx - eye_offset + 8, eye_y + 8],
        fill=(255, 255, 255, 255)
    )

    # Right Eye
    draw.ellipse(
        [cx + eye_offset - eye_r, eye_y - eye_r, cx + eye_offset + eye_r, eye_y + eye_r],
        fill=(6, 182, 212, 255)
    )
    draw.ellipse(
        [cx + eye_offset - 8, eye_y - 8, cx + eye_offset + 8, eye_y + 8],
        fill=(255, 255, 255, 255)
    )

    # Cheerful Smile arc
    smile_y = cy + 40
    draw.arc(
        [cx - 35, smile_y - 12, cx + 35, smile_y + 24],
        start=20,
        end=160,
        fill=(56, 189, 248, 255),
        width=6
    )

    # Side Ear Pods / Audio Nodes
    ear_w, ear_h = 24, 40
    # Left Ear
    draw.ellipse([cx - head_w - 14, cy - 20, cx - head_w + 14, cy + 20], fill=(6, 182, 212, 255), outline=(255, 255, 255, 200), width=3)
    # Right Ear
    draw.ellipse([cx + head_w - 14, cy - 20, cx + head_w + 14, cy + 20], fill=(6, 182, 212, 255), outline=(255, 255, 255, 200), width=3)

    # Bottom Core Badge: "DATANOVA"
    draw.rectangle([cx - 90, cy + 155, cx + 90, cy + 185], fill=(15, 23, 42, 255), outline=(56, 189, 248, 255), width=2)
    
    # Save 512x512 PNG
    img.save(output_png_512, format="PNG")
    print("Saved 512 PNG:", output_png_512)

    # Save 192x192 PNG
    img_192 = img.resize((192, 192), Image.LANCZOS)
    img_192.save(output_png_192, format="PNG")
    print("Saved 192 PNG:", output_png_192)

    # Save multi-size ICO
    icon_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    img.save(output_ico_path, format="ICO", sizes=icon_sizes)
    print("Saved multi-size ICO:", output_ico_path)

if __name__ == "__main__":
    ico_path = r"d:\datanova\datanova.ico"
    png_192 = r"d:\datanova\frontend\public\icon-192.png"
    png_512 = r"d:\datanova\frontend\public\icon-512.png"
    generate_datanova_icon(ico_path, png_192, png_512)
    # Also copy ico to frontend/public
    import shutil
    shutil.copyfile(ico_path, r"d:\datanova\frontend\public\datanova.ico")
