/* ============================================================
   VOCAB DATA — A1 → A2 Progress Path (90 days)
   ------------------------------------------------------------
   สำหรับผู้ที่ได้ระดับ A1 จาก Placement Test
   เรียนต่อ 90 วัน เพื่อยกระดับจาก A1 ไป A2
   Days 70-159 (90 days) — ค่อยๆ เพิ่มความยากจาก A1 ไป A2
   ============================================================ */

const VOCAB_DAYS_A1_TO_A2 = {
  /* ===== Phase 1: A1 Foundation (Days 70-99) ===== */
  "70": { day: 70, topic: "A1→A2: Morning Routine", date: "2026-10-10",
    vocabulary: [
      { word: "alarm", phonetic: "əˈlɑːm", pos: "noun", th: "นาฬิกาปลุก", exEn: "My alarm rings at 6 AM.", exTh: "นาฬิกาปลุกของฉันดังตอน 6 โมงเช้า" },
      { word: "shower", phonetic: "ˈʃaʊə", pos: "noun", th: "การอาบน้ำ / ฝักบัว", exEn: "I take a shower every morning.", exTh: "ฉันอาบน้ำทุกเช้า" },
      { word: "breakfast", phonetic: "ˈbrekfəst", pos: "noun", th: "อาหารเช้า", exEn: "I eat breakfast at 7 AM.", exTh: "ฉันทานอาหารเช้าตอน 7 โมง" },
      { word: "rush", phonetic: "rʌʃ", pos: "verb", th: "รีบเร่ง", exEn: "I rush to catch the bus.", exTh: "ฉันรีบไปให้ทันรถบัส" },
      { word: "arrive", phonetic: "əˈraɪv", pos: "verb", th: "มาถึง", exEn: "I arrive at work at 8 AM.", exTh: "ฉันมาถึงที่ทำงานตอน 8 โมง" },
      { word: "schedule", phonetic: "ˈʃedjuːl", pos: "noun", th: "ตารางเวลา", exEn: "My schedule is very busy today.", exTh: "ตารางวันนี้ของฉันแน่นมาก" }
    ],
    collocations: [
      { phrase: "wake up early", th: "ตื่นเช้า", exEn: "I wake up early on weekdays.", exTh: "ฉันตื่นเช้าในวันธรรมดา", note: "wake up = ตื่นนอน" },
      { phrase: "take a shower", th: "อาบน้ำ", exEn: "I take a shower before breakfast.", exTh: "ฉันอาบน้ำก่อนอาหารเช้า", note: "take a shower = อาบน้ำ" },
      { phrase: "catch the bus", th: "ทันรถบัส", exEn: "I catch the bus at 7:30.", exTh: "ฉันขึ้นรถบัสตอน 7:30", note: "catch = ให้ทัน" }
    ],
    idiom: { phrase: "early bird", meaning: "คนตื่นเช้า", exEn: "She's an early bird who wakes at 5 AM.", exTh: "เธอเป็นคนตื่นเช้าที่ตื่นตอนตี 5" }
  },

  "71": { day: 71, topic: "A1→A2: At Home", date: "2026-10-11",
    vocabulary: [
      { word: "kitchen", phonetic: "ˈkɪtʃɪn", pos: "noun", th: "ห้องครัว", exEn: "My mother is cooking in the kitchen.", exTh: "แม่กำลังทำอาหารในห้องครัว" },
      { word: "bedroom", phonetic: "ˈbedruːm", pos: "noun", th: "ห้องนอน", exEn: "My bedroom is small but cozy.", exTh: "ห้องนอนของฉันเล็กแต่อบอุ่น" },
      { word: "bathroom", phonetic: "ˈbɑːθruːm", pos: "noun", th: "ห้องน้ำ", exEn: "The bathroom is upstairs.", exTh: "ห้องน้ำอยู่ชั้นบน" },
      { word: "garden", phonetic: "ˈɡɑːdn", pos: "noun", th: "สวน", exEn: "We have a beautiful garden.", exTh: "เรามีสวนที่สวยงาม" },
      { word: "garage", phonetic: "ˈɡærɑːʒ", pos: "noun", th: "โรงรถ", exEn: "The car is in the garage.", exTh: "รถอยู่ในโรงรถ" },
      { word: "furniture", phonetic: "ˈfɜːnɪtʃə", pos: "noun", th: "เฟอร์นิเจอร์", exEn: "We bought new furniture.", exTh: "เราซื้อเฟอร์นิเจอร์ใหม่" }
    ],
    collocations: [
      { phrase: "living room", th: "ห้องนั่งเล่น", exEn: "We watch TV in the living room.", exTh: "เราดูทีวีในห้องนั่งเล่น", note: "living room = ห้องนั่งเล่น" },
      { phrase: "dining room", th: "ห้องทานอาหาร", exEn: "We eat dinner in the dining room.", exTh: "เราทานอาหารเย็นในห้องทานอาหาร", note: "dining room = ห้องทานข้าว" },
      { phrase: "do the chores", th: "ทำงานบ้าน", exEn: "I do the chores on weekends.", exTh: "ฉันทำงานบ้านวันหยุด", note: "chores = งานบ้าน" }
    ],
    idiom: { phrase: "home sweet home", meaning: "บ้านคือที่อบอุ่นที่สุด", exEn: "After the trip, it's home sweet home.", exTh: "หลังจากการเดินทาง บ้านคือที่อบอุ่นที่สุด" }
  },

  "72": { day: 72, topic: "A1→A2: Food & Cooking", date: "2026-10-12",
    vocabulary: [
      { word: "ingredient", phonetic: "ɪnˈɡriːdiənt", pos: "noun", th: "ส่วนผสม", exEn: "Fresh ingredients make better food.", exTh: "ส่วนผสมสดๆ ทำให้อาหารอร่อยกว่า" },
      { word: "recipe", phonetic: "ˈresəpi", pos: "noun", th: "สูตรอาหาร", exEn: "This recipe is easy to follow.", exTh: "สูตรนี้ทำตามง่าย" },
      { word: "boil", phonetic: "bɔɪl", pos: "verb", th: "ต้ม", exEn: "Boil the water first.", exTh: "ต้มน้ำก่อน" },
      { word: "fry", phonetic: "fraɪ", pos: "verb", th: "ทอด", exEn: "I fry the eggs in a pan.", exTh: "ฉันทอดไข่ในกระทะ" },
      { word: "chop", phonetic: "tʃɒp", pos: "verb", th: "สับ / หั่น", exEn: "Chop the onions finely.", exTh: "สับหัวหอมให้ละเอียด" },
      { word: "tasty", phonetic: "ˈteɪsti", pos: "adjective", th: "อร่อย", exEn: "This soup is very tasty.", exTh: "ซุปนี้อร่อยมาก" }
    ],
    collocations: [
      { phrase: "cook dinner", th: "ทำอาหารเย็น", exEn: "I cook dinner for my family.", exTh: "ฉันทำอาหารเย็นให้ครอบครัว", note: "cook + มื้ออาหาร" },
      { phrase: "prepare food", th: "เตรียมอาหาร", exEn: "We prepare food for the party.", exTh: "เราเตรียมอาหารสำหรับงานปาร์ตี้", note: "prepare = เตรียม" },
      { phrase: "sweet tooth", th: "ชอบของหวาน", exEn: "I have a sweet tooth.", exTh: "ฉันชอบของหวาน", note: "สำนวน แปลว่า ชอบของหวาน" }
    ],
    idiom: { phrase: "a piece of cake", meaning: "ง่ายมาก", exEn: "Cooking this dish is a piece of cake.", exTh: "การทำอาหารจานนี้ง่ายมาก" }
  },

  "73": { day: 73, topic: "A1→A2: Shopping", date: "2026-10-13",
    vocabulary: [
      { word: "customer", phonetic: "ˈkʌstəmə", pos: "noun", th: "ลูกค้า", exEn: "The customer wants a refund.", exTh: "ลูกค้าต้องการเงินคืน" },
      { word: "assistant", phonetic: "əˈsɪstənt", pos: "noun", th: "พนักงานขาย", exEn: "The assistant helped me find my size.", exTh: "พนักงานช่วยหาขนาดให้ฉัน" },
      { word: "discount", phonetic: "ˈdɪskaʊnt", pos: "noun", th: "ส่วนลด", exEn: "I got a 20% discount.", exTh: "ฉันได้ส่วนลด 20%" },
      { word: "receipt", phonetic: "rɪˈsiːt", pos: "noun", th: "ใบเสร็จ", exEn: "Keep your receipt for returns.", exTh: "เก็บใบเสร็จไว้สำหรับการคืนสินค้า" },
      { word: "bargain", phonetic: "ˈbɑːɡɪn", pos: "noun", th: "ของถูก", exEn: "This jacket was a real bargain.", exTh: "เสื้อตัวนี้ถูกมากจริงๆ" },
      { word: "refund", phonetic: "ˈriːfʌnd", pos: "noun", th: "เงินคืน", exEn: "I asked for a refund.", exTh: "ฉันขอเงินคืน" }
    ],
    collocations: [
      { phrase: "go shopping", th: "ไปช้อปปิ้ง", exEn: "We go shopping on Saturdays.", exTh: "เราไปช้อปปิ้งวันเสาร์", note: "go shopping = ซื้อของ" },
      { phrase: "best price", th: "ราคาที่ดีที่สุด", exEn: "This store has the best price.", exTh: "ร้านนี้มีราคาดีที่สุด", note: "best price = ราคาดีที่สุด" },
      { phrase: "on sale", th: "ลดราคา", exEn: "The shoes are on sale today.", exTh: "รองเท้าลดราคาวันนี้", note: "on sale = ลดราคา" }
    ],
    idiom: { phrase: "a good deal", meaning: "ข้อเสนอที่ดี / คุ้มค่า", exEn: "This phone was a good deal.", exTh: "โทรศัพท์เครื่องนี้คุ้มค่ามาก" }
  },

  "74": { day: 74, topic: "A1→A2: Weather & Seasons", date: "2026-10-14",
    vocabulary: [
      { word: "season", phonetic: "ˈsiːzn", pos: "noun", th: "ฤดูกาล", exEn: "Thailand has three seasons.", exTh: "ประเทศไทยมีสามฤดู" },
      { word: "spring", phonetic: "sprɪŋ", pos: "noun", th: "ฤดูใบไม้ผลิ", exEn: "Flowers bloom in spring.", exTh: "ดอกไม้บานในฤดูใบไม้ผลิ" },
      { word: "summer", phonetic: "ˈsʌmə", pos: "noun", th: "ฤดูร้อน", exEn: "Summer in Thailand is very hot.", exTh: "ฤดูร้อนในไทยร้อนมาก" },
      { word: "autumn", phonetic: "ˈɔːtəm", pos: "noun", th: "ฤดูใบไม้ร่วง", exEn: "Leaves fall in autumn.", exTh: "ใบไม้ร่วงในฤดูใบไม้ร่วง" },
      { word: "winter", phonetic: "ˈwɪntə", pos: "noun", th: "ฤดูหนาว", exEn: "It snows in winter.", exTh: "หิมะตกในฤดูหนาว" },
      { word: "umbrella", phonetic: "ʌmˈbrelə", pos: "noun", th: "ร่ม", exEn: "Take an umbrella, it's raining.", exTh: "เอาร่มไปด้วย ฝนตก" }
    ],
    collocations: [
      { phrase: "rainy season", th: "ฤดูฝน", exEn: "The rainy season starts in June.", exTh: "ฤดูฝนเริ่มในเดือนมิถุนายน", note: "rainy season = ฤดูฝน" },
      { phrase: "weather forecast", th: "พยากรณ์อากาศ", exEn: "The weather forecast says it will rain.", exTh: "พยากรณ์อากาศบอกว่าฝนจะตก", note: "forecast = พยากรณ์" },
      { phrase: "cold weather", th: "อากาศหนาว", exEn: "I don't like cold weather.", exTh: "ฉันไม่ชอบอากาศหนาว", note: "cold + weather" }
    ],
    idiom: { phrase: "under the weather", meaning: "รู้สึกไม่สบาย", exEn: "I'm feeling under the weather today.", exTh: "วันนี้ฉันรู้สึกไม่สบาย" }
  },

  "75": { day: 75, topic: "A1→A2: Travel & Transport", date: "2026-10-15",
    vocabulary: [
      { word: "journey", phonetic: "ˈdʒɜːni", pos: "noun", th: "การเดินทาง", exEn: "The journey took 5 hours.", exTh: "การเดินทางใช้เวลา 5 ชั่วโมง" },
      { word: "luggage", phonetic: "ˈlʌɡɪdʒ", pos: "noun", th: "กระเป๋าเดินทาง", exEn: "My luggage is too heavy.", exTh: "กระเป๋าของฉันหนักเกินไป" },
      { word: "platform", phonetic: "ˈplætfɔːm", pos: "noun", th: "ชานชาลา", exEn: "The train leaves from platform 3.", exTh: "รถไฟออกจากชานชาลา 3" },
      { word: "ticket", phonetic: "ˈtɪkɪt", pos: "noun", th: "ตั๋ว", exEn: "I bought a train ticket.", exTh: "ฉันซื้อตั๋วรถไฟ" },
      { word: "destination", phonetic: "ˌdestɪˈneɪʃn", pos: "noun", th: "จุดหมายปลายทาง", exEn: "Our destination is Chiang Mai.", exTh: "จุดหมายของเราคือเชียงใหม่" },
      { word: "passenger", phonetic: "ˈpæsɪndʒə", pos: "noun", th: "ผู้โดยสาร", exEn: "All passengers must wear seatbelts.", exTh: "ผู้โดยสารทุกคนต้องคาดเข็มขัดนิรภัย" }
    ],
    collocations: [
      { phrase: "book a ticket", th: "จองตั๋ว", exEn: "I booked a ticket online.", exTh: "ฉันจองตั๋วออนไลน์", note: "book = จอง" },
      { phrase: "go abroad", th: "ไปต่างประเทศ", exEn: "I want to go abroad next year.", exTh: "ฉันอยากไปต่างประเทศปีหน้า", note: "abroad = ต่างประเทศ" },
      { phrase: "catch a taxi", th: "ขึ้นแท็กซี่", exEn: "Let's catch a taxi to the hotel.", exTh: "ขึ้นแท็กซี่ไปโรงแรมกันเถอะ", note: "catch a taxi = เรียกแท็กซี่" }
    ],
    idiom: { phrase: "jet lag", meaning: "อาการเจ็ตแล็ก", exEn: "I always get jet lag after flying.", exTh: "ฉันมักมีอาการเจ็ตแล็กหลังบิน" }
  },

  "76": { day: 76, topic: "A1→A2: Health & Body", date: "2026-10-16",
    vocabulary: [
      { word: "medicine", phonetic: "ˈmedsn", pos: "noun", th: "ยา", exEn: "Take this medicine after meals.", exTh: "ทานยานี้หลังอาหาร" },
      { word: "fever", phonetic: "ˈfiːvə", pos: "noun", th: "ไข้", exEn: "She has a high fever.", exTh: "เธอมีไข้สูง" },
      { word: "cough", phonetic: "kɒf", pos: "verb", th: "ไอ", exEn: "He can't stop coughing.", exTh: "เขาไอไม่หยุด" },
      { word: "pain", phonetic: "peɪn", pos: "noun", th: "ความเจ็บปวด", exEn: "I have a pain in my back.", exTh: "ฉันปวดหลัง" },
      { word: "vitamin", phonetic: "ˈvɪtəmɪn", pos: "noun", th: "วิตามิน", exEn: "Eat fruits for vitamins.", exTh: "ทานผลไม้เพื่อวิตามิน" },
      { word: "rest", phonetic: "rest", pos: "verb", th: "พักผ่อน", exEn: "You need to rest more.", exTh: "คุณต้องพักผ่อนมากขึ้น" }
    ],
    collocations: [
      { phrase: "see a doctor", th: "ไปพบหมอ", exEn: "You should see a doctor.", exTh: "คุณควรไปพบหมอ", note: "see a doctor = ไปหาหมอ" },
      { phrase: "take medicine", th: "ทานยา", exEn: "Take your medicine now.", exTh: "ทานยาตอนนี้เลย", note: "take medicine = ทานยา" },
      { phrase: "feel better", th: "รู้สึกดีขึ้น", exEn: "I feel better today.", exTh: "วันนี้ฉันรู้สึกดีขึ้น", note: "feel better = ดีขึ้น" }
    ],
    idiom: { phrase: "as fit as a fiddle", meaning: "แข็งแรงมาก", exEn: "My grandfather is as fit as a fiddle.", exTh: "คุณตาของฉันแข็งแรงมาก" }
  },

  "77": { day: 77, topic: "A1→A2: School & Study", date: "2026-10-17",
    vocabulary: [
      { word: "homework", phonetic: "ˈhəʊmwɜːk", pos: "noun", th: "การบ้าน", exEn: "I have a lot of homework.", exTh: "ฉันมีการบ้านเยอะมาก" },
      { word: "subject", phonetic: "ˈsʌbdʒɪkt", pos: "noun", th: "วิชา", exEn: "My favorite subject is math.", exTh: "วิชาที่ชอบคือคณิตศาสตร์" },
      { word: "dictionary", phonetic: "ˈdɪkʃənri", pos: "noun", th: "พจนานุกรม", exEn: "Look it up in the dictionary.", exTh: "เปิดดูในพจนานุกรม" },
      { word: "exam", phonetic: "ɪɡˈzæm", pos: "noun", th: "การสอบ", exEn: "We have an exam next week.", exTh: "เราสอบอาทิตย์หน้า" },
      { word: "grade", phonetic: "ɡreɪd", pos: "noun", th: "เกรด", exEn: "I got a good grade in English.", exTh: "ฉันได้เกรดดีในภาษาอังกฤษ" },
      { word: "lesson", phonetic: "ˈlesn", pos: "noun", th: "บทเรียน", exEn: "The lesson was interesting.", exTh: "บทเรียนน่าสนใจ" }
    ],
    collocations: [
      { phrase: "do homework", th: "ทำการบ้าน", exEn: "I do my homework after school.", exTh: "ฉันทำการบ้านหลังเลิกเรียน", note: "do homework" },
      { phrase: "take an exam", th: "เข้าสอบ", exEn: "I'm taking an exam tomorrow.", exTh: "ฉันเข้าสอบพรุ่งนี้", note: "take an exam" },
      { phrase: "study hard", th: "เรียนหนัก", exEn: "She studies hard for her exams.", exTh: "เธอเรียนหนักเพื่อสอบ", note: "study hard = ตั้งใจเรียน" }
    ],
    idiom: { phrase: "learn by heart", meaning: "ท่องจำ", exEn: "I learned the poem by heart.", exTh: "ฉันท่องบทกวีขึ้นใจ" }
  },

  "78": { day: 78, topic: "A1→A2: Work & Careers", date: "2026-10-18",
    vocabulary: [
      { word: "salary", phonetic: "ˈsæləri", pos: "noun", th: "เงินเดือน", exEn: "He gets a good salary.", exTh: "เขาได้เงินเดือนดี" },
      { word: "meeting", phonetic: "ˈmiːtɪŋ", pos: "noun", th: "การประชุม", exEn: "We have a meeting at 10 AM.", exTh: "เราประชุมตอน 10 โมง" },
      { word: "deadline", phonetic: "ˈdedlaɪn", pos: "noun", th: "เส้นตาย", exEn: "The deadline is Friday.", exTh: "เส้นตายคือวันศุกร์" },
      { word: "boss", phonetic: "bɒs", pos: "noun", th: "เจ้านาย", exEn: "My boss is very kind.", exTh: "เจ้านายของฉันใจดีมาก" },
      { word: "colleague", phonetic: "ˈkɒliːɡ", pos: "noun", th: "เพื่อนร่วมงาน", exEn: "My colleagues are friendly.", exTh: "เพื่อนร่วมงานของฉันเป็นมิตร" },
      { word: "skills", phonetic: "skɪlz", pos: "noun", th: "ทักษะ", exEn: "Good communication skills are important.", exTh: "ทักษะการสื่อสารที่ดีสำคัญมาก" }
    ],
    collocations: [
      { phrase: "go to work", th: "ไปทำงาน", exEn: "I go to work by train.", exTh: "ฉันไปทำงานโดยรถไฟ", note: "go to work" },
      { phrase: "work overtime", th: "ทำงานล่วงเวลา", exEn: "I work overtime when busy.", exTh: "ฉันทำงานล่วงเวลาเมื่อยุ่ง", note: "overtime = ล่วงเวลา" },
      { phrase: "get promoted", th: "ได้เลื่อนตำแหน่ง", exEn: "She got promoted last month.", exTh: "เธอได้เลื่อนตำแหน่งเดือนที่แล้ว", note: "promoted = เลื่อนตำแหน่ง" }
    ],
    idiom: { phrase: "work like a horse", meaning: "ทำงานหนักมาก", exEn: "He works like a horse.", exTh: "เขาทำงานหนักมาก" }
  },

  "79": { day: 79, topic: "A1→A2: Free Time & Hobbies", date: "2026-10-19",
    vocabulary: [
      { word: "hobby", phonetic: "ˈhɒbi", pos: "noun", th: "งานอดิเรก", exEn: "My hobby is painting.", exTh: "งานอดิเรกของฉันคือวาดรูป" },
      { word: "painting", phonetic: "ˈpeɪntɪŋ", pos: "noun", th: "การวาดภาพ", exEn: "Painting makes me happy.", exTh: "การวาดภาพทำให้ฉันมีความสุข" },
      { word: "gardening", phonetic: "ˈɡɑːdnɪŋ", pos: "noun", th: "การทำสวน", exEn: "My father enjoys gardening.", exTh: "พ่อชอบทำสวน" },
      { word: "collect", phonetic: "kəˈlekt", pos: "verb", th: "สะสม", exEn: "I collect stamps.", exTh: "ฉันสะสมแสตมป์" },
      { word: "relax", phonetic: "rɪˈlæks", pos: "verb", th: "ผ่อนคลาย", exEn: "I relax by reading books.", exTh: "ฉันผ่อนคลายด้วยการอ่านหนังสือ" },
      { word: "boring", phonetic: "ˈbɔːrɪŋ", pos: "adjective", th: "น่าเบื่อ", exEn: "Watching TV is boring for me.", exTh: "การดูทีวีน่าเบื่อสำหรับฉัน" }
    ],
    collocations: [
      { phrase: "free time", th: "เวลาว่าง", exEn: "What do you do in your free time?", exTh: "คุณทำอะไรในเวลาว่าง?", note: "free time = เวลาว่าง" },
      { phrase: "play an instrument", th: "เล่นเครื่องดนตรี", exEn: "She plays the guitar.", exTh: "เธอเล่นกีตาร์", note: "play + the + instrument" },
      { phrase: "go for a walk", th: "ไปเดินเล่น", exEn: "We go for a walk in the park.", exTh: "เราเดินเล่นในสวน", note: "go for a walk = เดินเล่น" }
    ],
    idiom: { phrase: "pastime", meaning: "กิจกรรมยามว่าง", exEn: "Reading is my favorite pastime.", exTh: "การอ่านคืองานอดิเรกที่ชอบที่สุด" }
  },

  "80": { day: 80, topic: "A1→A2: Family & Friends", date: "2026-10-20",
    vocabulary: [
      { word: "relative", phonetic: "ˈrelətɪv", pos: "noun", th: "ญาติ", exEn: "We visit our relatives on holidays.", exTh: "เราไปเยี่ยมญาติวันหยุด" },
      { word: "neighbor", phonetic: "ˈneɪbə", pos: "noun", th: "เพื่อนบ้าน", exEn: "My neighbor is very friendly.", exTh: "เพื่อนบ้านของฉันเป็นมิตรมาก" },
      { word: "guest", phonetic: "ɡest", pos: "noun", th: "แขก", exEn: "We have guests tonight.", exTh: "คืนนี้เรามีแขก" },
      { word: "wedding", phonetic: "ˈwedɪŋ", pos: "noun", th: "งานแต่งงาน", exEn: "The wedding was beautiful.", exTh: "งานแต่งงานสวยงามมาก" },
      { word: "celebration", phonetic: "ˌselɪˈbreɪʃn", pos: "noun", th: "การเฉลิมฉลอง", exEn: "We had a celebration for her birthday.", exTh: "เราฉลองวันเกิดของเธอ" },
      { word: "together", phonetic: "təˈɡeðə", pos: "adverb", th: "ด้วยกัน", exEn: "We eat dinner together.", exTh: "เราทานอาหารเย็นด้วยกัน" }
    ],
    collocations: [
      { phrase: "family member", th: "สมาชิกครอบครัว", exEn: "Every family member helps.", exTh: "สมาชิกครอบครัวทุกคนช่วยกัน", note: "family member = คนในครอบครัว" },
      { phrase: "close friend", th: "เพื่อนสนิท", exEn: "She's my close friend.", exTh: "เธอเป็นเพื่อนสนิทของฉัน", note: "close friend = เพื่อนสนิท" },
      { phrase: "keep in touch", th: "ติดต่อกัน", exEn: "Let's keep in touch.", exTh: "มาติดต่อกันนะ", note: "keep in touch = ติดต่อกัน" }
    ],
    idiom: { phrase: "blood is thicker than water", meaning: "เลือดข้นกว่าน้ำ", exEn: "Family always helps, blood is thicker than water.", exTh: "ครอบครัวช่วยเสมอ เลือดข้นกว่าน้ำ" }
  },

  "81": { day: 81, topic: "A1→A2: Emotions & Feelings", date: "2026-10-21",
    vocabulary: [
      { word: "excited", phonetic: "ɪkˈsaɪtɪd", pos: "adjective", th: "ตื่นเต้น", exEn: "I'm excited about the trip.", exTh: "ฉันตื่นเต้นเกี่ยวกับทริป" },
      { word: "nervous", phonetic: "ˈnɜːvəs", pos: "adjective", th: "ประหม่า", exEn: "I feel nervous before exams.", exTh: "ฉันรู้สึกประหม่าก่อนสอบ" },
      { word: "proud", phonetic: "praʊd", pos: "adjective", th: "ภูมิใจ", exEn: "I'm proud of you.", exTh: "ฉันภูมิใจในตัวคุณ" },
      { word: "surprised", phonetic: "səˈpraɪzd", pos: "adjective", th: "ประหลาดใจ", exEn: "I was surprised by the news.", exTh: "ฉันประหลาดใจกับข่าว" },
      { word: "confident", phonetic: "ˈkɒnfɪdənt", pos: "adjective", th: "มั่นใจ", exEn: "She is confident about her English.", exTh: "เธอมั่นใจในภาษาอังกฤษของเธอ" },
      { word: "grateful", phonetic: "ˈɡreɪtfl", pos: "adjective", th: "รู้สึกขอบคุณ", exEn: "I'm grateful for your help.", exTh: "ฉันรู้สึกขอบคุณในความช่วยเหลือของคุณ" }
    ],
    collocations: [
      { phrase: "feel excited", th: "รู้สึกตื่นเต้น", exEn: "I feel excited about tomorrow.", exTh: "ฉันรู้สึกตื่นเต้นกับพรุ่งนี้", note: "feel + อารมณ์" },
      { phrase: "be proud of", th: "ภูมิใจใน", exEn: "We are proud of our son.", exTh: "เราภูมิใจในลูกชาย", note: "be proud of + คน" },
      { phrase: "good mood", th: "อารมณ์ดี", exEn: "She's in a good mood today.", exTh: "วันนี้เธออารมณ์ดี", note: "good mood = อารมณ์ดี" }
    ],
    idiom: { phrase: "on cloud nine", meaning: "มีความสุขสุดๆ", exEn: "She was on cloud nine after winning.", exTh: "เธอมีความสุขสุดๆ หลังชนะ" }
  },

  "82": { day: 82, topic: "A1→A2: Nature & Environment", date: "2026-10-22",
    vocabulary: [
      { word: "forest", phonetic: "ˈfɒrɪst", pos: "noun", th: "ป่าไม้", exEn: "The forest is full of animals.", exTh: "ป่าเต็มไปด้วยสัตว์" },
      { word: "mountain", phonetic: "ˈmaʊntən", pos: "noun", th: "ภูเขา", exEn: "We climbed the mountain.", exTh: "เราปีนภูเขา" },
      { word: "ocean", phonetic: "ˈəʊʃn", pos: "noun", th: "มหาสมุทร", exEn: "The ocean is very deep.", exTh: "มหาสมุทรลึกมาก" },
      { word: "pollution", phonetic: "pəˈluːʃn", pos: "noun", th: "มลพิษ", exEn: "Pollution is a big problem.", exTh: "มลพิษเป็นปัญหาใหญ่" },
      { word: "recycle", phonetic: "ˌriːˈsaɪkl", pos: "verb", th: "รีไซเคิล", exEn: "We should recycle plastic.", exTh: "เราควรรีไซเคิลพลาสติก" },
      { word: "protect", phonetic: "prəˈtekt", pos: "verb", th: "ปกป้อง", exEn: "We must protect the environment.", exTh: "เราต้องปกป้องสิ่งแวดล้อม" }
    ],
    collocations: [
      { phrase: "protect the environment", th: "ปกป้องสิ่งแวดล้อม", exEn: "We should protect the environment.", exTh: "เราควรปกป้องสิ่งแวดล้อม", note: "protect = ปกป้อง" },
      { phrase: "global warming", th: "โลกร้อน", exEn: "Global warming is getting worse.", exTh: "ภาวะโลกร้อนแย่ลง", note: "global warming = โลกร้อน" },
      { phrase: "save energy", th: "ประหยัดพลังงาน", exEn: "Turn off lights to save energy.", exTh: "ปิดไฟเพื่อประหยัดพลังงาน", note: "save energy = ประหยัดพลังงาน" }
    ],
    idiom: { phrase: "a drop in the ocean", meaning: "ส่วนเล็กน้อยมาก", exEn: "My effort is a drop in the ocean.", exTh: "ความพยายามของฉันเป็นเพียงส่วนเล็กน้อย" }
  },

  "83": { day: 83, topic: "A1→A2: Technology & Internet", date: "2026-10-23",
    vocabulary: [
      { word: "internet", phonetic: "ˈɪntənet", pos: "noun", th: "อินเทอร์เน็ต", exEn: "I use the internet daily.", exTh: "ฉันใช้อินเทอร์เน็ตทุกวัน" },
      { word: "website", phonetic: "ˈwebsaɪt", pos: "noun", th: "เว็บไซต์", exEn: "This website is helpful.", exTh: "เว็บไซต์นี้มีประโยชน์" },
      { word: "password", phonetic: "ˈpɑːswɜːd", pos: "noun", th: "รหัสผ่าน", exEn: "Don't share your password.", exTh: "อย่าแชร์รหัสผ่านของคุณ" },
      { word: "download", phonetic: "ˌdaʊnˈləʊd", pos: "verb", th: "ดาวน์โหลด", exEn: "Download the app for free.", exTh: "ดาวน์โหลดแอปฟรี" },
      { word: "message", phonetic: "ˈmesɪdʒ", pos: "noun", th: "ข้อความ", exEn: "I sent you a message.", exTh: "ฉันส่งข้อความถึงคุณ" },
      { word: "screen", phonetic: "skriːn", pos: "noun", th: "หน้าจอ", exEn: "The screen is too bright.", exTh: "หน้าจอสว่างเกินไป" }
    ],
    collocations: [
      { phrase: "surf the internet", th: "ท่องอินเทอร์เน็ต", exEn: "I surf the internet for news.", exTh: "ฉันท่องอินเทอร์เน็ตหาข่าว", note: "surf the internet = ท่องเน็ต" },
      { phrase: "send an email", th: "ส่งอีเมล", exEn: "I sent an email to my boss.", exTh: "ฉันส่งอีเมลถึงเจ้านาย", note: "send + email" },
      { phrase: "social media", th: "โซเชียลมีเดีย", exEn: "Social media connects people.", exTh: "โซเชียลมีเดียเชื่อมคนเข้าด้วยกัน", note: "social media = สื่อสังคม" }
    ],
    idiom: { phrase: "go viral", meaning: "กลายเป็นไวรัล", exEn: "The video went viral.", exTh: "วิดีโอไวรัลมาก" }
  },

  "84": { day: 84, topic: "A1→A2: City Life", date: "2026-10-24",
    vocabulary: [
      { word: "traffic", phonetic: "ˈtræfɪk", pos: "noun", th: "การจราจร", exEn: "Traffic is terrible in Bangkok.", exTh: "การจราจรในกรุงเทพฯ แย่มาก" },
      { word: "subway", phonetic: "ˈsʌbweɪ", pos: "noun", th: "รถไฟใต้ดิน", exEn: "The subway is faster than a bus.", exTh: "รถไฟใต้ดินเร็วกว่ารถบัส" },
      { word: "building", phonetic: "ˈbɪldɪŋ", pos: "noun", th: "อาคาร", exEn: "That building is very tall.", exTh: "อาคารนั้นสูงมาก" },
      { word: "crowded", phonetic: "ˈkraʊdɪd", pos: "adjective", th: "แออัด/พลุกพล่าน", exEn: "The market is crowded on weekends.", exTh: "ตลาดแออัดในวันหยุด" },
      { word: "pollution", phonetic: "pəˈluːʃn", pos: "noun", th: "มลพิษ", exEn: "Air pollution is a problem in cities.", exTh: "มลพิษทางอากาศเป็นปัญหาในเมือง" },
      { word: "noise", phonetic: "nɔɪz", pos: "noun", th: "เสียงรบกวน", exEn: "I can't sleep because of the noise.", exTh: "ฉันนอนไม่หลับเพราะเสียงรบกวน" }
    ],
    collocations: [
      { phrase: "traffic jam", th: "รถติด", exEn: "I was stuck in a traffic jam.", exTh: "ฉันติดอยู่ในการจราจร", note: "traffic jam = รถติด" },
      { phrase: "city center", th: "ใจกลางเมือง", exEn: "We live in the city center.", exTh: "เราอยู่ใจกลางเมือง", note: "city center = ใจกลางเมือง" },
      { phrase: "public transport", th: "ขนส่งสาธารณะ", exEn: "Public transport is convenient.", exTh: "ขนส่งสาธารณะสะดวก", note: "public transport = รถสาธารณะ" }
    ],
    idiom: { phrase: "rush hour", meaning: "ชั่วโมงเร่งด่วน", exEn: "Avoid the subway during rush hour.", exTh: "หลีกเลี่ยงรถไฟใต้ดินช่วงชั่วโมงเร่งด่วน" }
  },

  "85": { day: 85, topic: "A1→A2: Restaurants & Food", date: "2026-10-25",
    vocabulary: [
      { word: "menu", phonetic: "ˈmenjuː", pos: "noun", th: "เมนู", exEn: "Can I see the menu, please?", exTh: "ขอดูเมนูหน่อยได้ไหม?" },
      { word: "waiter", phonetic: "ˈweɪtə", pos: "noun", th: "พนักงานเสิร์ฟ", exEn: "The waiter is very polite.", exTh: "พนักงานเสิร์ฟสุภาพมาก" },
      { word: "delicious", phonetic: "dɪˈlɪʃəs", pos: "adjective", th: "อร่อยมาก", exEn: "This food is delicious.", exTh: "อาหารนี้อร่อยมาก" },
      { word: "order", phonetic: "ˈɔːdə", pos: "verb", th: "สั่งอาหาร", exEn: "I'd like to order fried rice.", exTh: "ฉันขอสั่งข้าวผัด" },
      { word: "bill", phonetic: "bɪl", pos: "noun", th: "บิล/ใบแจ้งเงิน", exEn: "Can we have the bill, please?", exTh: "ขอบิลหน่อยได้ไหม?" },
      { word: "tasty", phonetic: "ˈteɪsti", pos: "adjective", th: "อร่อย", exEn: "The soup is very tasty.", exTh: "ซุปอร่อยมาก" }
    ],
    collocations: [
      { phrase: "order food", th: "สั่งอาหาร", exEn: "Let's order food online.", exTh: "มาสั่งอาหารออนไลน์กันเถอะ", note: "order + อาหาร" },
      { phrase: "pay the bill", th: "จ่ายบิล", exEn: "I'll pay the bill.", exTh: "ฉันจะจ่ายบิลเอง", note: "pay the bill = จ่ายเงิน" },
      { phrase: "table for two", th: "โต๊ะสำหรับ 2 คน", exEn: "A table for two, please.", exTh: "ขอโต๊ะสำหรับ 2 คน", note: "table for + จำนวนคน" }
    ],
    idiom: { phrase: "eat like a horse", meaning: "กินจุมาก", exEn: "He eats like a horse.", exTh: "เขากินจุมาก" }
  },

  "86": { day: 86, topic: "A1→A2: Clothes & Fashion", date: "2026-10-26",
    vocabulary: [
      { word: "fashion", phonetic: "ˈfæʃn", pos: "noun", th: "แฟชั่น", exEn: "She follows fashion closely.", exTh: "เธอติดตามแฟชั่นอย่างใกล้ชิด" },
      { word: "size", phonetic: "saɪz", pos: "noun", th: "ไซส์/ขนาด", exEn: "What size do you wear?", exTh: "คุณใส่ไซส์อะไร?" },
      { word: "style", phonetic: "staɪl", pos: "noun", th: "สไตล์", exEn: "I like your style.", exTh: "ฉันชอบสไตล์ของคุณ" },
      { word: "comfortable", phonetic: "ˈkʌmftəbl", pos: "adjective", th: "สบาย", exEn: "These shoes are very comfortable.", exTh: "รองเท้านี้สบายมาก" },
      { word: "expensive", phonetic: "ɪkˈspensɪv", pos: "adjective", th: "แพง", exEn: "This dress is too expensive.", exTh: "ชุดนี้แพงเกินไป" },
      { word: "casual", phonetic: "ˈkæʒuəl", pos: "adjective", th: "ลำลอง", exEn: "Wear casual clothes to the party.", exTh: "ใส่เสื้อผ้าลำลองไปงานปาร์ตี้" }
    ],
    collocations: [
      { phrase: "try on", th: "ลองใส่", exEn: "Can I try on this shirt?", exTh: "ขอลองใส่เสื้อตัวนี้ได้ไหม?", note: "try on = ลอง" },
      { phrase: "fit well", th: "พอดีตัว", exEn: "This jacket fits well.", exTh: "เสื้อตัวนี้พอดีตัว", note: "fit = พอดี" },
      { phrase: "match", th: "เข้ากัน", exEn: "Your shoes match your bag.", exTh: "รองเท้าคุณเข้ากับกระเป๋า", note: "match = เข้ากัน" }
    ],
    idiom: { phrase: "dress to impress", meaning: "แต่งตัวให้ดูดี", exEn: "She dressed to impress at the interview.", exTh: "เธอแต่งตัวให้ดูดีในงานสัมภาษณ์" }
  },

  /* ===== Phase 2: A2 Foundation (Days 100-129) ===== */
  "100": { day: 100, topic: "A2: Daily Conversations", date: "2026-11-09",
    vocabulary: [
      { word: "conversation", phonetic: "ˌkɒnvəˈseɪʃn", pos: "noun", th: "การสนทนา", exEn: "We had a nice conversation.", exTh: "เราสนทนากันอย่างดี" },
      { word: "opinion", phonetic: "əˈpɪnjən", pos: "noun", th: "ความคิดเห็น", exEn: "What's your opinion?", exTh: "คุณคิดเห็นอย่างไร?" },
      { word: "suggestion", phonetic: "səˈdʒestʃən", pos: "noun", th: "ข้อเสนอแนะ", exEn: "Thanks for your suggestion.", exTh: "ขอบคุณสำหรับข้อเสนอแนะ" },
      { word: "invite", phonetic: "ɪnˈvaɪt", pos: "verb", th: "เชิญ", exEn: "I want to invite you to dinner.", exTh: "ฉันอยากเชิญคุณไปทานอาหารเย็น" },
      { word: "promise", phonetic: "ˈprɒmɪs", pos: "verb", th: "สัญญา", exEn: "I promise to call you.", exTh: "ฉันสัญญาว่าจะโทรหาคุณ" },
      { word: "explain", phonetic: "ɪkˈspleɪn", pos: "verb", th: "อธิบาย", exEn: "Can you explain this again?", exTh: "ช่วยอธิบายนี้อีกครั้งได้ไหม?" }
    ],
    collocations: [
      { phrase: "have a conversation", th: "สนทนา", exEn: "We had a long conversation.", exTh: "เราสนทนากันยาวนาน", note: "have a conversation" },
      { phrase: "small talk", th: "พูดคุยทั่วๆ ไป", exEn: "Let's make small talk.", exTh: "มาพูดคุยกันเล่นๆ", note: "small talk = คุยเล่น" },
      { phrase: "in my opinion", th: "ในความคิดของฉัน", exEn: "In my opinion, it's a good idea.", exTh: "ในความคิดของฉัน มันเป็นความคิดที่ดี", note: "in my opinion" }
    ],
    idiom: { phrase: "break the ice", meaning: "ทำลายน้ำแข็ง/เริ่มคุย", exEn: "She told a joke to break the ice.", exTh: "เธอเล่าเรื่องตลกเพื่อเริ่มคุย" }
  },

  "101": { day: 101, topic: "A2: Places in Town", date: "2026-11-10",
    vocabulary: [
      { word: "library", phonetic: "ˈlaɪbrəri", pos: "noun", th: "ห้องสมุด", exEn: "I study at the library.", exTh: "ฉันอ่านหนังสือที่ห้องสมุด" },
      { word: "post office", phonetic: "pəʊst ɒfɪs", pos: "noun", th: "ไปรษณีย์", exEn: "The post office is near the bank.", exTh: "ไปรษณีย์อยู่ใกล้ธนาคาร" },
      { word: "supermarket", phonetic: "ˈsuːpəmɑːkɪt", pos: "noun", th: "ซูเปอร์มาร์เก็ต", exEn: "I buy food at the supermarket.", exTh: "ฉันซื้ออาหารที่ซูเปอร์มาร์เก็ต" },
      { word: "pharmacy", phonetic: "ˈfɑːməsi", pos: "noun", th: "ร้านขายยา", exEn: "The pharmacy opens at 8 AM.", exTh: "ร้านขายยาเปิด 8 โมง" },
      { word: "bakery", phonetic: "ˈbeɪkəri", pos: "noun", th: "ร้านขนมปัง", exEn: "The bakery smells wonderful.", exTh: "ร้านขนมปังหอมมาก" },
      { word: "museum", phonetic: "mjuˈziːəm", pos: "noun", th: "พิพิธภัณฑ์", exEn: "The museum is free on Mondays.", exTh: "พิพิธภัณฑ์เข้าฟรีวันจันทร์" }
    ],
    collocations: [
      { phrase: "go to the library", th: "ไปห้องสมุด", exEn: "I go to the library every week.", exTh: "ฉันไปห้องสมุดทุกสัปดาห์", note: "go to + สถานที่" },
      { phrase: "buy groceries", th: "ซื้อของชำ", exEn: "I buy groceries at the supermarket.", exTh: "ฉันซื้อของชำที่ซูเปอร์มาร์เก็ต", note: "groceries = ของชำ" },
      { phrase: "post a letter", th: "ส่งจดหมาย", exEn: "I need to post a letter.", exTh: "ฉันต้องส่งจดหมาย", note: "post a letter = ส่งจดหมาย" }
    ],
    idiom: { phrase: "around the corner", meaning: "ใกล้มาก/อยู่หัวมุมถนน", exEn: "The bank is just around the corner.", exTh: "ธนาคารอยู่หัวมุมถนนแค่นี้เอง" }
  },

  "102": { day: 102, topic: "A2: Health & Fitness", date: "2026-11-11",
    vocabulary: [
      { word: "exercise", phonetic: "ˈeksəsaɪz", pos: "noun", th: "การออกกำลังกาย", exEn: "Exercise keeps you healthy.", exTh: "การออกกำลังกายทำให้สุขภาพดี" },
      { word: "gym", phonetic: "dʒɪm", pos: "noun", th: "โรงยิม", exEn: "I go to the gym three times a week.", exTh: "ฉันไปยิมสัปดาห์ละสามครั้ง" },
      { word: "diet", phonetic: "ˈdaɪət", pos: "noun", th: "การควบคุมอาหาร", exEn: "A balanced diet is important.", exTh: "อาหารที่สมดุลสำคัญมาก" },
      { word: "weight", phonetic: "weɪt", pos: "noun", th: "น้ำหนัก", exEn: "I want to lose weight.", exTh: "ฉันอยากลดน้ำหนัก" },
      { word: "stretch", phonetic: "stretʃ", pos: "verb", th: "ยืดเส้น", exEn: "Stretch before exercising.", exTh: "ยืดเส้นก่อนออกกำลังกาย" },
      { word: "healthy", phonetic: "ˈhelθi", pos: "adjective", th: "สุขภาพดี", exEn: "Eating vegetables is healthy.", exTh: "การทานผักดีต่อสุขภาพ" }
    ],
    collocations: [
      { phrase: "do exercise", th: "ออกกำลังกาย", exEn: "I do exercise every morning.", exTh: "ฉันออกกำลังกายทุกเช้า", note: "do exercise" },
      { phrase: "lose weight", th: "ลดน้ำหนัก", exEn: "I need to lose weight.", exTh: "ฉันต้องลดน้ำหนัก", note: "lose weight = ลดน้ำหนัก" },
      { phrase: "stay fit", th: "รักษาความฟิต", exEn: "Running helps me stay fit.", exTh: "การวิ่งช่วยให้ฉันฟิต", note: "stay fit = รักษาสุขภาพ" }
    ],
    idiom: { phrase: "in good shape", meaning: "สุขภาพดี/ฟิต", exEn: "He's in good shape for his age.", exTh: "เขาสุขภาพดีสำหรับอายุของเขา" }
  },

  "103": { day: 103, topic: "A2: Money & Banking", date: "2026-11-12",
    vocabulary: [
      { word: "cash", phonetic: "kæʃ", pos: "noun", th: "เงินสด", exEn: "Do you pay by cash or card?", exTh: "คุณจ่ายด้วยเงินสดหรือบัตร?" },
      { word: "account", phonetic: "əˈkaʊnt", pos: "noun", th: "บัญชี", exEn: "I opened a bank account.", exTh: "ฉันเปิดบัญชีธนาคาร" },
      { word: "loan", phonetic: "ləʊn", pos: "noun", th: "เงินกู้", exEn: "He took a loan to buy a car.", exTh: "เขากู้เงินซื้อรถ" },
      { word: "savings", phonetic: "ˈseɪvɪŋz", pos: "noun", th: "เงินออม", exEn: "I keep my savings in the bank.", exTh: "ฉันเก็บเงินออมไว้ในธนาคาร" },
      { word: "budget", phonetic: "ˈbʌdʒɪt", pos: "noun", th: "งบประมาณ", exEn: "We have a monthly budget.", exTh: "เรามีงบประมาณรายเดือน" },
      { word: "expensive", phonetic: "ɪkˈspensɪv", pos: "adjective", th: "แพง", exEn: "Living in Bangkok is expensive.", exTh: "การอยู่กรุงเทพฯ แพง" }
    ],
    collocations: [
      { phrase: "open an account", th: "เปิดบัญชี", exEn: "I want to open an account.", exTh: "ฉันอยากเปิดบัญชี", note: "open an account" },
      { phrase: "save money", th: "ออมเงิน", exEn: "I save money every month.", exTh: "ฉันออมเงินทุกเดือน", note: "save money = เก็บเงิน" },
      { phrase: "pay by card", th: "จ่ายด้วยบัตร", exEn: "Can I pay by card?", exTh: "จ่ายด้วยบัตรได้ไหม?", note: "pay by + วิธีจ่าย" }
    ],
    idiom: { phrase: "break even", meaning: "เท่าทุน", exEn: "The business finally broke even.", exTh: "ธุรกิจเท่าทุนในที่สุด" }
  },

  "120": { day: 120, topic: "A2: Education & Learning", date: "2026-11-29",
    vocabulary: [
      { word: "education", phonetic: "ˌedʒuˈkeɪʃn", pos: "noun", th: "การศึกษา", exEn: "Education is important for everyone.", exTh: "การศึกษาสำคัญสำหรับทุกคน" },
      { word: "scholarship", phonetic: "ˈskɒləʃɪp", pos: "noun", th: "ทุนการศึกษา", exEn: "She won a scholarship to study abroad.", exTh: "เธอได้รับทุนไปเรียนต่างประเทศ" },
      { word: "knowledge", phonetic: "ˈnɒlɪdʒ", pos: "noun", th: "ความรู้", exEn: "Reading increases your knowledge.", exTh: "การอ่านเพิ่มความรู้ของคุณ" },
      { word: "practice", phonetic: "ˈpræktɪs", pos: "noun", th: "การฝึกฝน", exEn: "Practice makes perfect.", exTh: "การฝึกฝนทำให้เก่ง" },
      { word: "improve", phonetic: "ɪmˈpruːv", pos: "verb", th: "พัฒนา/ปรับปรุง", exEn: "I want to improve my English.", exTh: "ฉันอยากพัฒนาภาษาอังกฤษ" },
      { word: "understand", phonetic: "ˌʌndəˈstænd", pos: "verb", th: "เข้าใจ", exEn: "Do you understand the lesson?", exTh: "คุณเข้าใจบทเรียนไหม?" }
    ],
    collocations: [
      { phrase: "learn a language", th: "เรียนภาษา", exEn: "I'm learning a new language.", exTh: "ฉันกำลังเรียนภาษาใหม่", note: "learn + ภาษา" },
      { phrase: "study abroad", th: "เรียนต่างประเทศ", exEn: "She wants to study abroad.", exTh: "เธออยากเรียนต่างประเทศ", note: "study abroad = เรียนต่างประเทศ" },
      { phrase: "gain knowledge", th: "ได้รับความรู้", exEn: "We gain knowledge from books.", exTh: "เราได้รับความรู้จากหนังสือ", note: "gain = ได้รับ" }
    ],
    idiom: { phrase: "learn the ropes", meaning: "เรียนรู้งาน", exEn: "It takes time to learn the ropes.", exTh: "ต้องใช้เวลาเรียนรู้งาน" }
  },

  "130": { day: 130, topic: "A2: Social Media & Communication", date: "2026-12-09",
    vocabulary: [
      { word: "profile", phonetic: "ˈprəʊfaɪl", pos: "noun", th: "โปรไฟล์", exEn: "Update your profile picture.", exTh: "อัปเดตรูปโปรไฟล์ของคุณ" },
      { word: "follow", phonetic: "ˈfɒləʊ", pos: "verb", th: "ติดตาม", exEn: "I follow many YouTubers.", exTh: "ฉันติดตามยูทูเบอร์หลายคน" },
      { word: "share", phonetic: "ʃeə", pos: "verb", th: "แชร์", exEn: "Share the video with friends.", exTh: "แชร์วิดีโอกับเพื่อนๆ" },
      { word: "comment", phonetic: "ˈkɒment", pos: "verb", th: "คอมเมนต์", exEn: "She commented on my post.", exTh: "เธอคอมเมนต์โพสต์ของฉัน" },
      { word: "post", phonetic: "pəʊst", pos: "verb", th: "โพสต์", exEn: "He posts photos every day.", exTh: "เขาโพสต์รูปทุกวัน" }
    ],
    collocations: [
      { phrase: "social media", th: "โซเชียลมีเดีย", exEn: "Social media is everywhere.", exTh: "โซเชียลมีเดียอยู่ทุกที่", note: "social media = สื่อสังคม" },
      { phrase: "online friends", th: "เพื่อนออนไลน์", exEn: "I have many online friends.", exTh: "ฉันมีเพื่อนออนไลน์หลายคน", note: "online = ออนไลน์" }
    ],
    idiom: { phrase: "go viral", meaning: "กลายเป็นไวรัล", exEn: "The dance went viral.", exTh: "ท่าเต้นกลายเป็นไวรัล" }
  },

  "140": { day: 140, topic: "A2: Health & Emergency", date: "2026-12-19",
    vocabulary: [
      { word: "emergency", phonetic: "ɪˈmɜːdʒənsi", pos: "noun", th: "เหตุฉุกเฉิน", exEn: "Call 911 in an emergency.", exTh: "โทร 911 ในเหตุฉุกเฉิน" },
      { word: "ambulance", phonetic: "ˈæmbjələns", pos: "noun", th: "รถพยาบาล", exEn: "The ambulance arrived quickly.", exTh: "รถพยาบาลมาถึงเร็ว" },
      { word: "injured", phonetic: "ˈɪndʒəd", pos: "adjective", th: "ได้รับบาดเจ็บ", exEn: "He was injured in the accident.", exTh: "เขาได้รับบาดเจ็บจากอุบัติเหตุ" },
      { word: "treatment", phonetic: "ˈtriːtmənt", pos: "noun", th: "การรักษา", exEn: "The treatment was successful.", exTh: "การรักษาประสบความสำเร็จ" },
      { word: "recover", phonetic: "rɪˈkʌvə", pos: "verb", th: "หายป่วย", exEn: "She recovered quickly.", exTh: "เธอหายเร็ว" }
    ],
    collocations: [
      { phrase: "first aid", th: "ปฐมพยาบาล", exEn: "Learn basic first aid.", exTh: "เรียนรู้การปฐมพยาบาลเบื้องต้น", note: "first aid = ปฐมพยาบาล" },
      { phrase: "feel unwell", th: "รู้สึกไม่สบาย", exEn: "I feel unwell today.", exTh: "วันนี้ฉันรู้สึกไม่สบาย", note: "feel unwell = ไม่สบาย" }
    ],
    idiom: { phrase: "out of the woods", meaning: "พ้นอันตราย", exEn: "She's not out of the woods yet.", exTh: "เธอยังไม่พ้นอันตราย" }
  },

  "150": { day: 150, topic: "A2: Future Plans", date: "2026-12-29",
    vocabulary: [
      { word: "future", phonetic: "ˈfjuːtʃə", pos: "noun", th: "อนาคต", exEn: "What are your plans for the future?", exTh: "แผนการของคุณในอนาคตคืออะไร?" },
      { word: "ambition", phonetic: "æmˈbɪʃn", pos: "noun", th: "ความทะเยอทะยาน", exEn: "Her ambition is to become a doctor.", exTh: "ความทะเยอทะยานของเธอคือการเป็นหมอ" },
      { word: "dream", phonetic: "driːm", pos: "noun", th: "ความฝัน", exEn: "Follow your dreams.", exTh: "ตามความฝันของคุณ" },
      { word: "goal", phonetic: "ɡəʊl", pos: "noun", th: "เป้าหมาย", exEn: "My goal is to speak English fluently.", exTh: "เป้าหมายของฉันคือพูดภาษาอังกฤษคล่อง" },
      { word: "achievement", phonetic: "əˈtʃiːvmənt", pos: "noun", th: "ความสำเร็จ", exEn: "Winning was a great achievement.", exTh: "การชนะเป็นความสำเร็จที่ยิ่งใหญ่" },
      { word: "succeed", phonetic: "səkˈsiːd", pos: "verb", th: "ประสบความสำเร็จ", exEn: "Work hard and you will succeed.", exTh: "ทำงานหนักแล้วคุณจะประสบความสำเร็จ" }
    ],
    collocations: [
      { phrase: "achieve a goal", th: "บรรลุเป้าหมาย", exEn: "She achieved her goal.", exTh: "เธอบรรลุเป้าหมาย", note: "achieve = บรรลุ" },
      { phrase: "in the future", th: "ในอนาคต", exEn: "I want to travel in the future.", exTh: "ฉันอยากเดินทางในอนาคต", note: "in the future" },
      { phrase: "look forward to", th: "รอคอย", exEn: "I look forward to meeting you.", exTh: "ฉันรอคอยที่จะพบคุณ", note: "look forward to + ing" }
    ],
    idiom: { phrase: "reach for the stars", meaning: "มุ่งสู่ความสำเร็จสูงสุด", exEn: "Always reach for the stars.", exTh: "มุ่งสู่ความสำเร็จสูงสุดเสมอ" }
  },

  "159": { day: 159, topic: "A2: Final Review & Celebration", date: "2026-01-07",
    vocabulary: [
      { word: "celebrate", phonetic: "ˈselɪbreɪt", pos: "verb", th: "เฉลิมฉลอง", exEn: "Let's celebrate your success!", exTh: "มาฉลองความสำเร็จของคุณกันเถอะ!" },
      { word: "progress", phonetic: "ˈprəʊɡres", pos: "noun", th: "ความก้าวหน้า", exEn: "You've made great progress.", exTh: "คุณก้าวหน้าไปมาก" },
      { word: "confident", phonetic: "ˈkɒnfɪdənt", pos: "adjective", th: "มั่นใจ", exEn: "I feel more confident now.", exTh: "ตอนนี้ฉันมั่นใจมากขึ้น" },
      { word: "fluent", phonetic: "ˈfluːənt", pos: "adjective", th: "คล่องแคล่ว", exEn: "She speaks fluent English.", exTh: "เธอพูดภาษาอังกฤษคล่อง" },
      { word: "proud", phonetic: "praʊd", pos: "adjective", th: "ภูมิใจ", exEn: "I'm proud of how far I've come.", exTh: "ฉันภูมิใจที่ก้าวมาไกลขนาดนี้" },
      { word: "continue", phonetic: "kənˈtɪnjuː", pos: "verb", th: "ดำเนินต่อไป", exEn: "Continue learning every day.", exTh: "เรียนรู้ต่อไปทุกวัน" }
    ],
    collocations: [
      { phrase: "make progress", th: "ก้าวหน้า", exEn: "You make progress every day.", exTh: "คุณก้าวหน้าทุกวัน", note: "make progress" },
      { phrase: "well done", th: "ทำได้ดีมาก", exEn: "Well done on finishing the course!", exTh: "ทำได้ดีมากที่เรียนจบคอร์ส!", note: "well done = ทำได้ดี" },
      { phrase: "keep going", th: "ไปต่อ/อย่าหยุด", exEn: "Keep going, you're almost there!", exTh: "ไปต่อเถอะ ใกล้ถึงแล้ว!", note: "keep going = ทำต่อไป" }
    ],
    idiom: { phrase: "the sky is the limit", meaning: "ไม่มีอะไรจำกัดความสำเร็จ", exEn: "With hard work, the sky is the limit.", exTh: "ด้วยความขยัน ไม่มีอะไรจำกัดความสำเร็จ" }
  }
};