import os
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

def add_heading_1(doc, text):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.name = 'TH Sarabun PSK'
    run.font.size = Pt(18)
    run.font.bold = True
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(6)
    return p

def add_heading_2(doc, text):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.name = 'TH Sarabun PSK'
    run.font.size = Pt(16)
    run.font.bold = True
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(4)
    return p

def add_body_paragraph(doc, text):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.name = 'TH Sarabun PSK'
    run.font.size = Pt(16)
    run.font.color.rgb = RGBColor(0, 0, 0)
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.first_line_indent = Inches(0.5)
    return p

def create_complete_report():
    doc = Document()
    
    # Page Margins
    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.5)
        section.right_margin = Inches(1.0)
        
    # Default style
    style = doc.styles['Normal']
    style.font.name = 'TH Sarabun PSK'
    style.font.size = Pt(16)
    
    # --- COVER PAGE ---
    title_p = doc.add_paragraph()
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_run = title_p.add_run("รายงานโครงงานคอมพิวเตอร์\nเรื่อง ระบบเว็บแอปพลิเคชันอัจฉริยะสำหรับฝึกคำศัพท์ภาษาอังกฤษ\nด้วยเทคนิคการทบทวนเว้นระยะและเกมการศึกษา\n(Vocab Trainer)")
    title_run.font.name = 'TH Sarabun PSK'
    title_run.font.size = Pt(20)
    title_run.font.bold = True
    title_p.paragraph_format.space_after = Pt(36)
    
    by_p = doc.add_paragraph()
    by_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    by_run = by_p.add_run("โดย\n1. คณะผู้จัดทำโครงงาน\n\nเสนอ\nคุณครูที่ปรึกษาโครงงาน\n\nรายงานฉบับนี้เป็นส่วนประกอบหนึ่งของการศึกษาโครงงานคอมพิวเตอร์\nปีการศึกษา 2569")
    by_run.font.name = 'TH Sarabun PSK'
    by_run.font.size = Pt(16)
    doc.add_page_break()
    
    # --- ABSTRACT ---
    add_heading_1(doc, "บทคัดย่อ")
    add_body_paragraph(doc, "โครงงานเรื่อง 'ระบบเว็บแอปพลิเคชันอัจฉริยะสำหรับฝึกคำศัพท์ภาษาอังกฤษด้วยเทคนิคการทบทวนเว้นระยะและเกมการศึกษา (Vocab Trainer)' มีวัตถุประสงค์เพื่อพัฒนาเว็บแอปพลิเคชันช่วยจำคำศัพท์ภาษาอังกฤษที่มีประสิทธิภาพ ช่วยแก้ปัญหาความน่าเบื่อในการท่องจำ และช่วยให้ผู้เรียนจดจำคำศัพท์ได้ระยะยาวผ่านอัลกอริทึมการทบทวนเว้นระยะ (Spaced Repetition) ร่วมกับมินิเกมฝึกทักษะ 10 รูปแบบ คลังคำศัพท์ครอบคลุม 6 ระดับมาตรฐานสากล (CEFR A1-C2) กว่า 3,600 คำ ผลการประเมินความพึงพอใจพบว่า ผู้ใช้งานมีความพึงพอใจต่อระบบในระดับดีมาก ช่วยส่งเสริมการเรียนรู้ภาษาอังกฤษได้อย่างสนุกสนานและใช้งานได้จริงบนทุกอุปกรณ์")
    doc.add_page_break()
    
    # --- CHAPTER 1 ---
    add_heading_1(doc, "บทที่ 1\nบทนำ")
    
    add_heading_2(doc, "1.1 ความความเป็นมาและความสำคัญของปัญหา")
    add_body_paragraph(doc, "ในปัจจุบันภาษาอังกฤษมีความสำคัญอย่างยิ่งในฐานะภาษาสากลสำหรับการสื่อสาร การศึกษา และการทำงาน แต่ผู้เรียนส่วนใหญ่มักประสบปัญหาการจำคำศัพท์ไม่ได้ ท่องจำแล้วลืมง่ายเนื่องจากขาดการทบทวนอย่างเป็นระบบ และมีความเบื่อหน่ายกับการท่องศัพท์แบบเดิมๆ ผู้จัดทำจึงมีความสนใจพัฒนาเว็บแอปพลิเคชัน 'Vocab Trainer' ขึ้นมา เพื่อช่วยให้การเรียนรู้คำศัพท์เป็นเรื่องที่สนุกสนาน เข้าถึงได้ง่าย และมีความคงทนในการจำผ่านระบบการทบทวนเว้นระยะอัตโนมัติ")
    
    add_heading_2(doc, "1.2 วัตถุประสงค์ของโครงงาน")
    add_body_paragraph(doc, "1. เพื่อพัฒนาเว็บแอปพลิเคชันฝึกคำศัพท์ภาษาอังกฤษด้วยเทคนิคการทบทวนเว้นระยะ\n2. เพื่อสร้างคลังคำศัพท์มาตรฐาน CEFR ระดับ A1 ถึง C2 รวม 3,600 คำ พร้อมตัวอย่างประโยค\n3. เพื่อพัฒนาโหมดมินิเกมและแบบฝึกหัด 10 รูปแบบเพื่อสร้างแรงจูงใจในการเรียนรู้\n4. เพื่อประเมินความพึงพอใจของผู้ใช้งานที่มีต่อระบบ")
    
    add_heading_2(doc, "1.3 ขอบเขตของโครงงาน")
    add_body_paragraph(doc, "1. ด้านเนื้อหา: คลังคำศัพท์ภาษาอังกฤษระดับ A1-C2 กว่า 3,600 คำ พร้อมคำแปล สำนวน และประโยคตัวอย่าง\n2. ด้านเทคโนโลยี: พัฒนาด้วย HTML5, CSS3, JavaScript (PWA) และ Firebase สำหรับซิงค์ข้อมูล\n3. ด้านฟังก์ชัน: ระบบทดสอบวัดระดับ (Placement Test), มินิเกม 10 รูปแบบ, ระบบทบทวนคำศัพท์ที่จำยาก (Weak Words), และสถิติการเรียนรู้")
    
    add_heading_2(doc, "1.4 ประโยชน์ที่คาดว่าจะได้รับ")
    add_body_paragraph(doc, "1. ผู้เรียนสามารถจดจำคำศัพท์ภาษาอังกฤษได้อย่างยาวนานผ่านระบบทบทวนเว้นระยะ\n2. ได้รับสื่อการเรียนรู้ออนไลน์ที่ใช้งานได้ฟรี ไม่มีโฆษณา และรองรับทุกอุปกรณ์\n3. ส่งเสริมให้เยาวชนใช้เวลาว่างให้เป็นประโยชน์ในการพัฒนาตนเอง")
    
    add_heading_2(doc, "1.5 นิยามศัพท์เฉพาะ")
    add_body_paragraph(doc, "1. Spaced Repetition (การทบทวนเว้นระยะ): เทคนิคการทบทวนคำศัพท์ในระยะเวลาที่เหมาะสมก่อนที่สมองจะเริ่มลืม\n2. CEFR: กรอบมาตรฐานสากลที่ใช้ระบุระดับความสามารถทางภาษา (A1 ถึง C2)\n3. Gamification: การนำแนวคิดและกลไกของเกมมาประยุกต์ใช้เพื่อสร้างความสนุกและแรงจูงใจ")
    
    doc.add_page_break()
    
    # --- CHAPTER 2 ---
    add_heading_1(doc, "บทที่ 2\nเอกสารและทฤษฎีที่เกี่ยวข้อง")
    add_body_paragraph(doc, "การจัดทำโครงงานนี้ คณะผู้จัดทำได้ศึกษาเอกสารและทฤษฎีที่เกี่ยวข้องดังนี้:")
    
    add_heading_2(doc, "2.1 กรอบมาตรฐานสากล CEFR")
    add_body_paragraph(doc, "กรอบมาตรฐานความสามารถทางภาษาของสหภาพยุโรป (CEFR) เป็นเกณฑ์สากลที่ใช้วัดระดับความภาษา แบ่งเป็น A1, A2, B1, B2, C1 และ C2 ช่วยให้ผู้เรียนเลือกเรียนคำศัพท์ได้เหมาะสมกับพื้นฐานของตนเอง")
    
    add_heading_2(doc, "2.2 ภาษา HTML, CSS และ JavaScript")
    add_body_paragraph(doc, "เป็นเทคโนโลยีหลักในการสร้างเว็บไซต์ โดย HTML ใช้สร้างโครงสร้างเนื้อหา, CSS ใช้ตกแต่งความสวยงามและจัดหน้าจอ, และ JavaScript ใช้สร้างระบบการทำงานแบบโต้ตอบกับผู้ใช้")
    
    add_heading_2(doc, "2.3 ทฤษฎีการลืมและการทบทวนเว้นระยะ (Spaced Repetition)")
    add_body_paragraph(doc, "อ้างอิงจากเส้นโค้งการลืมของเอบบ์เฮาส์ (Ebbinghaus Forgetting Curve) มนุษย์จะลืมข้อมูลส่วนใหญ่หากไม่ทบทวน ระบบทบทวนเว้นระยะจึงเข้ามาช่วยคำนวณรอบเวลาที่ควรทบทวนซ้ำเพื่อให้จำได้แม่นยำยิ่งขึ้น")
    
    add_heading_2(doc, "2.4 การนำเกมมาใช้ในการศึกษา (Gamification)")
    add_body_paragraph(doc, "การใส่ระบบคะแนนสะสม เลเวล ภารกิจประจำวัน และมินิเกม ช่วยให้ผู้เรียนไม่รู้สึกเบื่อหน่าย และกระตุ้นให้เข้ามาฝึกฝนอย่างต่อเนื่อง")
    
    doc.add_page_break()
    
    # --- CHAPTER 3 ---
    add_heading_1(doc, "บทที่ 3\nอุปกรณ์และวิธีการดำเนินการ")
    add_body_paragraph(doc, "ในการพัฒนาเว็บแอปพลิเคชัน Vocab Trainer คณะผู้จัดทำได้ดำเนินการตามขั้นตอนดังนี้:")
    
    add_heading_2(doc, "3.1 กลุ่มเป้าหมาย")
    add_body_paragraph(doc, "นักเรียนและผู้สนใจทั่วไปที่ต้องการพัฒนาคำศัพท์ภาษาอังกฤษ จำนวน 25 คน")
    
    add_heading_2(doc, "3.2 เครื่องมือที่ใช้ในการพัฒนา")
    add_body_paragraph(doc, "1. เครื่องคอมพิวเตอร์และโปรแกรม Visual Studio Code สำหรับเขียนโค้ด\n2. ภาษา HTML5, CSS3, JavaScript และ Firebase สำหรับจัดเก็บข้อมูล\n3. เว็บเบราว์เซอร์ Google Chrome สำหรับทดสอบระบบ")
    
    add_heading_2(doc, "3.3 ขั้นตอนการดำเนินงาน")
    add_body_paragraph(doc, "1. ศึกษาปัญหาและรวบรวมความต้องการของผู้ใช้งาน\n2. ออกแบบหน้าตาเว็บไซต์ (UI/UX) และโครงสร้างฐานข้อมูลคำศัพท์\n3. พัฒนาระบบหลัก มินิเกม และระบบทบทวนคำศัพท์\n4. ทดสอบการใช้งานและปรับปรุงแก้ไขข้อบกพร่อง\n5. นำไปให้กลุ่มตัวอย่างใช้งานจริงและประเมินความพึงพอใจ")
    
    add_heading_2(doc, "3.4 การประเมินผล")
    add_body_paragraph(doc, "ใช้แบบประเมินความพึงพอใจตามเกณฑ์ Likert Scale 5 ระดับ เพื่อประเมินประสิทธิภาพและความพึงพอใจของผู้ใช้งาน")
    
    output_path = os.path.join(r"C:\Users\HP\Desktop\codex\project-report", "Vocab_Trainer_Project_Report_Complete_New.docx")
    doc.save(output_path)
    print(f"Successfully generated complete Word report at {output_path}")

if __name__ == "__main__":
    create_complete_report()
