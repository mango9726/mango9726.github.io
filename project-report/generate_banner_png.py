import os
from PIL import Image, ImageDraw, ImageFont

def generate_banner():
    # 240x60 cm at high resolution (4:1 aspect ratio, e.g. 3840 x 960 pixels)
    width = 3840
    height = 960
    
    # Create base image with dark gradient background
    img = Image.new("RGBA", (width, height), (15, 23, 42, 255)) # #0f172a
    draw = ImageDraw.Draw(img)
    
    # Draw background gradient simulation & glowing orbs
    # Orb 1 (Indigo top-left)
    for r in range(600, 0, -15):
        alpha = int(120 * (1 - r / 600))
        draw.ellipse([(-200 + 600-r), (-200 + 600-r), (400 + r), (400 + r)], fill=(99, 102, 241, alpha))
        
    # Orb 2 (Purple bottom-right)
    for r in range(700, 0, -15):
        alpha = int(100 * (1 - r / 700))
        draw.ellipse([(width - 500 - r, height - 500 - r), (width + 200 + r, height + 200 + r)], fill=(168, 85, 247, alpha))

    # Try loading a system font, fallback to default if not found
    try:
        # Windows standard Thai/English font
        font_title = ImageFont.truetype("C:\\Windows\\Fonts\\tahoma.ttf", 64)
        font_sub = ImageFont.truetype("C:\\Windows\\Fonts\\tahoma.ttf", 36)
        font_badge = ImageFont.truetype("C:\\Windows\\Fonts\\tahoma.ttf", 28)
    except IOError:
        font_title = ImageFont.load_default()
        font_sub = ImageFont.load_default()
        font_badge = ImageFont.load_default()
        
    # Draw Badge pill
    badge_text = " Vocab Trainer · Smart English Learning Platform "
    # Draw Title
    title_text = "ระบบเว็บแอปพลิเคชันอัจฉริยะสำหรับฝึกคำศัพท์ภาษาอังกฤษ"
    sub_text = "เสริมสร้างคลังคำศัพท์ 3,600 คำ ด้วยเทคนิค FSRS-5 Spaced Repetition และมินิเกม 10 รูปแบบ"
    
    # Draw Texts (Centered)
    # Using textbbox for modern Pillow
    def draw_centered_text(draw, y, text, font, fill):
        bbox = draw.textbbox((0, 0), text, font=font)
        w = bbox[2] - bbox[0]
        x = (width - w) / 2
        draw.text((x, y), text, font=font, fill=fill)
        
    draw_centered_text(draw, 220, badge_text, font_badge, (203, 213, 225, 255))
    draw_centered_text(draw, 320, title_text, font_title, (255, 255, 255, 255))
    draw_centered_text(draw, 430, sub_text, font_sub, (148, 163, 184, 255))
    
    # Save image
    output_dir = r"C:\Users\HP\Desktop\codex\web\vocab\assets\img"
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "vocab-banner-240x60cm.png")
    img.save(output_path, "PNG")
    print(f"Successfully generated PNG banner at {output_path}")

if __name__ == "__main__":
    generate_banner()
