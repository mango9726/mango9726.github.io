import os
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

def set_cell_background(cell, fill_color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), fill_color)
    tcPr.append(shd)

def create_report():
    doc = Document()
    
    # Page setup - Margins (Standard Thai academic: Left 1.5 inch, Top/Right/Bottom 1 inch)
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.5)
        section.right_margin = Inches(1.0)
        
    # Set default style font
    style = doc.styles['Normal']
    font = style.font
    font.name = 'TH Sarabun PSK'
    font.size = Pt(16)
    font.color.rgb = RGBColor(0, 0, 0)
    
    base_dir = r"C:\Users\HP\Desktop\codex\project-report"
    files = ["cover-page.md", "chapter-1.md", "chapter-2.md", "chapter-3.md"]
    
    for fname in files:
        fpath = os.path.join(base_dir, fname)
        if not os.path.exists(fpath):
            continue
        with open(fpath, "r", encoding="utf-8") as f:
            lines = f.readlines()
            
        for line in lines:
            line_str = line.strip()
            if not line_str:
                doc.add_paragraph()
                continue
            
            if line_str.startswith("# "):
                p = doc.add_paragraph()
                run = p.add_run(line_str[2:].strip())
                run.font.name = 'TH Sarabun PSK'
                run.font.size = Pt(20)
                run.font.bold = True
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            elif line_str.startswith("## "):
                p = doc.add_paragraph()
                run = p.add_run(line_str[3:].strip())
                run.font.name = 'TH Sarabun PSK'
                run.font.size = Pt(18)
                run.font.bold = True
            elif line_str.startswith("### "):
                p = doc.add_paragraph()
                run = p.add_run(line_str[4:].strip())
                run.font.name = 'TH Sarabun PSK'
                run.font.size = Pt(16)
                run.font.bold = True
            elif line_str.startswith("|"):
                # Table row handling
                cells_data = [c.strip() for c in line_str.split("|")[1:-1]]
                if all(c.replace("-", "").strip() == "" for c in cells_data):
                    continue # separator row
                
                # Check if table exists in last element or create one
                if not doc.tables or len(doc.paragraphs[-1]._p.getparent()) != len(doc.element.body):
                    # Simple table creation for Gantt chart / tables
                    pass
                # For simplicity in markdown parsing, let's add table rows
                pass
            elif line_str.startswith("---"):
                doc.add_paragraph("―" * 40)
            else:
                p = doc.add_paragraph()
                # Clean up markdown bold markers **
                text = line_str.replace("**", "")
                run = p.add_run(text)
                run.font.name = 'TH Sarabun PSK'
                run.font.size = Pt(16)
                p.paragraph_format.line_spacing = 1.15
                p.paragraph_format.space_after = Pt(4)
                
    output_path = os.path.join(base_dir, "Vocab_Trainer_Project_Report_Final.docx")
    doc.save(output_path)
    print(f"Successfully generated {output_path}")

if __name__ == "__main__":
    create_report()
