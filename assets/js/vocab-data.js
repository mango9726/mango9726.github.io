/* ============================================================
   VOCAB DATA  —  อัปเดตทุกวันโดย Claude
   ------------------------------------------------------------
   วิธีเพิ่มวันใหม่: ก๊อป Block ของ "1" แล้วเปลี่ยนเป็นเลขวันใหม่
   (day, topic, date) แล้วเติม vocabulary / collocations / idiom
   - vocabulary:  { word, pos, th, exEn, exTh }
   - collocations:{ phrase, th, exEn, exTh, note }   // th = ความหมายภาษาไทยของ collocation
   - idiom:       { phrase, meaning, exEn, exTh }
   อย่าลบวันเก่า เพื่อให้ระบบทบทวน (SRS) ทำงานได้ต่อเนื่อง
   ============================================================ */

const VOCAB_DAYS = {
  "1": {
    day: 1,
    topic: "Random",
    date: "2026-07-12",
    vocabulary: [
      { word: "accomplish", phonetic: "əˈkʌm.plɪʃ", pos: "verb", th: "บรรลุผล / ทำสำเร็จ", exEn: "She worked late every night to accomplish her goals.", exTh: "เธอทำงานดึกทุกคืนเพื่อบรรลุเป้าหมายของเธอ" },
      { word: "genuine", phonetic: "ˈdʒen.ju.ɪn", pos: "adjective", th: "แท้จริง / จริงใจ", exEn: "He showed genuine concern when I told him the bad news.", exTh: "เขาแสดงความห่วงใยอย่างจริงใจเมื่อฉันเล่าเรื่องไม่ดีให้ฟัง" },
      { word: "exhausted", phonetic: "ɪɡˈzɔː.stɪd", pos: "adjective", th: "เหนื่อยอย่างหนัก / หมดแรง", exEn: "After the long hike, we were completely exhausted.", exTh: "หลังจากเดินป่าที่ยาวนาน เราก็เหนื่อยหมดแรงไปเลย" },
      { word: "resemble", phonetic: "rɪˈzem.bəl", pos: "verb", th: "มีลักษณะคล้ายกับ", exEn: "The baby resembles her mother more than her father.", exTh: "เด็กทารกมีหน้าตาคล้ายกับแม่มากกว่าพ่อ" },
      { word: "bargain", phonetic: "ˈbɑː.ɡɪn", pos: "noun", th: "ของราคาถูก / การต่อรอง", exEn: "I found this jacket at a bargain in the sale.", exTh: "ฉันซื้อเสื้อตัวนี้ได้ในราคาถูกในช่วงลดราคา" },
      { word: "punctual", phonetic: "ˈpʌŋk.tʃu.əl", pos: "adjective", th: "ตรงต่อเวลา", exEn: "Our teacher is always punctual, so don't be late.", exTh: "ครูของเราตรงต่อเวลาเสมอ ดังนั้นอย่าวงมาสาย" },
      { word: "shortage", phonetic: "ˈʃɔː.tɪdʒ", pos: "noun", th: "ภาวะขาดแคลน", exEn: "There is a shortage of clean water in some villages.", exTh: "มีภาวะขาดแคลนน้ำสะอาดในบางหมู่บ้าน" },
      { word: "volunteer", phonetic: "ˌvɒl.ənˈtɪər", pos: "verb", th: "อาสาช่วย / เป็นอาสาสมัคร", exEn: "He decided to volunteer at the animal shelter on weekends.", exTh: "เขาตัดสินใจอาสาช่วยที่ศูนย์พักพิงสัตว์ในวันหยุดสุดสัปดาห์" },
      { word: "worthwhile", phonetic: "ˈwɜːθˌwaɪl", pos: "adjective", th: "คุ้มค่า", exEn: "Learning a new language is a worthwhile hobby.", exTh: "การเรียนภาษาใหม่เป็นงานอดิเรกที่คุ้มค่า" }
    ],
    collocations: [
      { phrase: "make a decision", th: "ตัดสินใจ", exEn: "We need to make a decision before the deadline.", exTh: "เราต้องตัดสินใจก่อนกำหนดเส้นตาย", note: "อย่าพูด \"do a decision\" — ต้องใช้ make เสมอ" },
      { phrase: "take a break", th: "พักเบรก / หยุดพัก", exEn: "Let's take a break and continue after lunch.", exTh: "มาพักเบรกแล้วค่อยทำต่อหลังอาหารเที่ยงสิ", note: "ไม่ใช้ \"make a break\" — ใช้ take a break" },
      { phrase: "pay attention", th: "ให้ความสนใจ / ตั้งใจ", exEn: "Please pay attention to the instructions.", exTh: "โปรดตั้งใจฟังคำแนะนำ", note: "อย่าใช้ \"listen attention\" — ถ้าจะใช้ listen ต้องเป็น listen to ส่วน pay attention ใช้คู่กับ pay attention to" },
      { phrase: "keep a promise", th: "รักษาคำสัญญา", exEn: "He always keeps a promise he makes to his friends.", exTh: "เขามักจะรักษาคำสัญญาที่ให้ไว้กับเพื่อนเสมอ", note: "ไม่ใช้ \"hold a promise\" หรือ \"maintain a promise\" — ใช้ keep" },
      { phrase: "get along with", th: "เข้ากับ (คน) ได้ดี", exEn: "Do you get along with your new roommate?", exTh: "คุณเข้ากับเพื่อนร่วมห้องใหม่ได้ดีไหม", note: "ต้องตามด้วย with (get along with somebody) — อย่าใช้ \"get along of\"" }
    ],
    idiom: {
      phrase: "break the ice",
      meaning: "ทำลายความเขินอาย / เริ่มต้นให้บรรยากาศผ่อนคลาย",
      exEn: "She told a funny story to break the ice at the party.",
      exTh: "เธอเล่าเรื่องตลกเพื่อทำลายบรรยากาศตึงเครียดในงานปาร์ตี้"
    }
  },

  "2": {
    day: 2,
    topic: "Random",
    date: "2026-07-14",
    vocabulary: [
      { word: "anticipate", phonetic: "ænˈtɪs.ɪ.peɪt", pos: "verb", th: "คาดการณ์ล่วงหน้า / เตรียมพร้อมก่อน", exEn: "We anticipate a large crowd at the concert tonight.", exTh: "เราคาดการณ์ว่าจะมีคนมาร่วมคอนเสิร์ตเยอะมากในคืนนี้" },
      { word: "reliable", phonetic: "rɪˈlaɪ.ə.bəl", pos: "adjective", th: "น่าเชื่อถือ / ไว้ใจได้", exEn: "She is a reliable friend who always keeps her word.", exTh: "เธอเป็นเพื่อนที่น่าเชื่อถือและมักจะรักษาคำพูดเสมอ" },
      { word: "overwhelm", phonetic: "ˌəʊ.vəˈwelm", pos: "verb", th: "ครอบงำ / ทำให้จนใจ", exEn: "The amount of homework overwhelmed the new students.", exTh: "ปริมาณการบ้านทำให้เด็กใหม่รู้สึกจนใจไปหมด" },
      { word: "efficient", phonetic: "ɪˈfɪʃ.ənt", pos: "adjective", th: "มีประสิทธิภาพ / ทำงานได้ผลดี", exEn: "The new software makes the team more efficient.", exTh: "ซอฟต์แวร์ใหม่ทำให้ทีมทำงานมีประสิทธิภาพมากขึ้น" },
      { word: "hesitate", phonetic: "ˈhez.ɪ.teɪt", pos: "verb", th: "รีรอ / ลังเล", exEn: "Don't hesitate to ask me if you need help.", exTh: "อย่าลังเลที่จะถามฉันถ้าคุณต้องการความช่วยเหลือ" },
      { word: "tolerate", phonetic: "ˈtɒl.ər.eɪt", pos: "verb", th: "ทนทาน / อดทนต่อ", exEn: "I cannot tolerate loud noise when I'm studying.", exTh: "ฉันทนเสียงดังไม่ได้ตอนที่กำลังอ่านหนังสือ" },
      { word: "crucial", phonetic: "ˈkruː.ʃəl", pos: "adjective", th: "สำคัญอย่างยิ่ง / ชี้เป็นชี้ตาย", exEn: "Sleep is crucial for your health and concentration.", exTh: "การนอนหลับมีความสำคัญอย่างยิ่งต่อสุขภาพและสมาธิของคุณ" },
      { word: "enormous", phonetic: "ɪˈnɔː.məs", pos: "adjective", th: "มหาศาล / ใหญ่โตมาก", exEn: "The project required an enormous amount of effort.", exTh: "โปรเจกต์นี้ต้องการความพยายามมหาศาล" },
      { word: "persuade", phonetic: "pəˈsweɪd", pos: "verb", th: "โน้มน้าว / ชักจูง", exEn: "He persuaded his boss to give him a day off.", exTh: "เขาโน้มน้าวบอสให้ให้วันหยุดเขาหนึ่งวัน" }
    ],
    collocations: [
      { phrase: "make progress", th: "ก้าวหน้า / ทำความก้าวหน้า", exEn: "You've made great progress with your English.", exTh: "คุณทำความก้าวหน้าเรื่องภาษาอังกฤษได้มากเลย", note: "อย่าใช้ \"do progress\" — ต้องใช้ make progress เสมอ" },
      { phrase: "take responsibility", th: "รับผิดชอบ", exEn: "It's time to take responsibility for your mistakes.", exTh: "ถึงเวลาที่คุณต้องรับผิดชอบต่อความผิดพลาดของตัวเอง", note: "ไม่ใช้ \"make responsibility\" — ใช้ take responsibility" },
      { phrase: "get rid of", th: "กำจัด / ทิ้งไป", exEn: "I want to get rid of these old clothes.", exTh: "ฉันอยากกำจัดเสื้อผ้าเก่าเหล่านี้ทิ้งไป", note: "แปลว่า \"กำจัด / ทิ้งไป\" — อย่าแปลทีละพยางค์ว่า get = ได้, rid = หลุด" },
      { phrase: "keep in touch", th: "คอยติดต่อกันเรื่อยๆ", exEn: "Let's keep in touch after you move abroad.", exTh: "มาติดต่อกันเรื่อยๆ นะหลังจากคุณย้ายไปต่างประเทศ", note: "ไม่ใช้ \"stay in touch with\" ผิด แต่ stay in touch ก็ใช้ได้ — ต่างจาก keep on touch ที่ผิด" },
      { phrase: "pay a visit", th: "แวะไปเยี่ยม / ไปเยี่ยม", exEn: "We should pay a visit to our grandparents this weekend.", exTh: "เราควรแวะไปเยี่ยมย่าตายายในสุดสัปดาห์นี้", note: "อย่าใช้ \"make a visit\" — ใช้ pay a visit" }
    ],
    idiom: {
      phrase: "hit the nail on the head",
      meaning: "พูดตรงประเด็น / ถูกต้องแม่นยำ",
      exEn: "You hit the nail on the head — that's exactly the problem.",
      exTh: "คุณพูดตรงประเด็นเป๊ะเลย — นั่นแหละคือปัญหาที่แท้จริง"
    }
  },

  "3": {
    day: 3,
    topic: "Random",
    date: "2026-07-27",
    vocabulary: [
      { word: "summarize", phonetic: "ˈsʌm.ə.raɪz", pos: "verb", th: "สรุป / ย่างยี้สาร", exEn: "Can you summarize the main points of the meeting?", exTh: "คุณสรุปประเด็มหลักของการประชุมได้ไหม" },
      { word: "benefit", phonetic: "ˈben.ɪ.fɪt", pos: "noun", th: "เงินอุดหนุน / ประโยชน์", exEn: "Regular exercise has many benefits for your health.", exTh: "การออกกำลังกายสม่ำเสมอมีประโยชน์มากมายต่อสุขภาพของคุณ" },
      { word: "consume", phonetic: "kənˈsuːm", pos: "verb", th: "ใช้ (สินค้า) / บริโภค", exEn: "We consume a lot of energy when we exercise.", exTh: "เราใช้แรงงานมากเมื่อออกกำลังกาย" },
      { word: "borrow", phonetic: "ˈbɒr.əʊ", pos: "verb", th: "ยืม", exEn: "Can I borrow your pen for a minute?", exTh: "ฉันขอยืมปากกาคุณสักครู่ได้ไหม" },
      { word: "interfere", phonetic: "ˌɪn.təˈfɪər", pos: "verb", th: "รบกวน / แทรกซึม", exEn: "Don't interfere when adults are talking.", exTh: "อย่าไปรบกวนเมื่อผู้ใหญ่กำลังคุยกัน" },
      { word: "restrict", phonetic: "rɪˈstrikt", pos: "verb", th: "จำกัด / ควบขวาง", exEn: "The new law restricts smoking in public places.", exTh: "กฎหมายใหม่จำกัดการสูบบุหรี่ในที่สาธารณะ" },
      { word: "obtain", phonetic: "əbˈteɪn", pos: "verb", th: "ได้รับ / เป็นของ", exEn: "You can obtain a driver's license at sixteen.", exTh: "คุณสามารถได้รับใบขับขี่ได้ที่อายุสิบหก" },
      { word: "permit", phonetic: "ˈpɜː.mɪt", pos: "verb", th: "อนุญาต / ให้ได้", exEn: "The teacher permits us to leave early today.", exTh: "ครูอนุญาตให้เราเลิกเรียนเที่ยงวันนี้" }
    ],
    collocations: [
      { phrase: "take a risk", th: "กล้าลองผิดพลาด", exEn: "Starting a business takes a lot of risk.", exTh: "การเริ่มต้นทำธุรกิจคำนึงถึงความเสี่ยงมากมาย", note: "อย่าใช้ \"make a risk\" — ใช้ take a risk เสมอ" },
      { phrase: "give up", th: "ยอมแล้ง / เลิกทำ", exEn: "Don't give up even if it gets difficult.", exTh: "อย่ายอมแล้วยะเมื่อมันดูเป็นไปได้ยาก", note: "ไม่ใช่ \"give in\" — give up หมายถึงเลิกพยายามบ่อยครั้ง" },
      { phrase: "run out of", th: "หมด / ใช้หมด", exEn: "We've run out of milk this morning.", exTh: "เราเติมนมหมดแล้วตอนเช้า" },
      { phrase: "in charge of", th: "รับผิดชอบ", exEn: "My sister is in charge of cooking dinner.", exTh: "น้องสาวของฉันรับผิดชอบการทำอาหารเย็ง" },
      { phrase: "bring up", th: "เลี้ยง / ชวนพูดถึง", exEn: "My parents brought me up to be polite.", exTh: "พ่อแม่เลี้ยงฉันให้เป็นคนที่สุภาพ" }
    ],
    idiom: {
      phrase: "piece of cake",
      meaning: "ง่ายๆ เลย / ไม่มีหลอก",
      exEn: "This test is a piece of cake!",
      exTh: "ข้อสอบนี้ง่ายๆ เลย!"
    }
  }
};
