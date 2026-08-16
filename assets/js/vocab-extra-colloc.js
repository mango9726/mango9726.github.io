/* ============================================================
   VOCAB COLLOC/IDIOM — Additional 30 per level for Day 31-60
   Each level keeps its own pattern:
   A1 = 1 collocation/day, A2 = 2/day, B1-B2-C1-C2 = 3/day
   B1-C2 also get 1 idiom/day (30 extra idioms).
   ============================================================ */

const VOCAB_EXTRA_COLLOC_A1 = [
  {"phrase":"open the door","th":"เปิดประตู","exEn":"Please open the door.","exTh":"ช่วยเปิดประตูหน่อย"},
  {"phrase":"close the window","th":"ปิดหน้าต่าง","exEn":"Close the window, please.","exTh":"ช่วยปิดหน้าต่างหน่อย"},
  { phrase: "drink some water", th: "ดื่มน้ำ", exEn: "Drink some water now.", exTh: "ดื่มน้ำสักหน่อยเถอะ" },
  {"phrase":"eat dinner","th":"กินอาหารเย็น","exEn":"We eat dinner at eight.","exTh":"พวกเรากินอาหารเย็นตอนสองทุ่ม"},
  { phrase: "go to school", th: "ไปโรงเรียน", exEn: "We go to school daily.", exTh: "พวกเราไปโรงเรียนทุกวัน" },
  {"phrase":"read the news","th":"อ่านข่าว","exEn":"He reads the news daily.","exTh":"เขาอ่านข่าวทุกวัน"},
  {"phrase":"listen to the radio","th":"ฟังวิทยุ","exEn":"Grandma listens to the radio.","exTh":"คุณยายฟังวิทยุ"},
  {"phrase":"watch a movie","th":"ดูหนัง","exEn":"We watch a movie tonight.","exTh":"พวกเราดูหนังคืนนี้"},
  {"phrase":"play basketball","th":"เล่นบาสเกตบอล","exEn":"They play basketball after school.","exTh":"พวกเขาเล่นบาสเกตบอลหลังเลิกเรียน"},
  {"phrase":"take a taxi","th":"นั่งแท็กซี่","exEn":"Take a taxi to the station.","exTh":"นั่งแท็กซี่ไปสถานี"},
  { phrase: "do homework", th: "ทำการบ้าน", exEn: "Do your homework first.", exTh: "ทำการบ้านก่อน" },
  { phrase: "get up early", th: "ตื่นแต่เช้า", exEn: "I get up early daily.", exTh: "ฉันตื่นแต่เช้าทุกวัน" },
  {"phrase":"go to sleep","th":"ไปนอนหลับ","exEn":"Go to sleep early.","exTh":"ไปนอนแต่หัวค่ำ"},
  { phrase: "wash your hands", th: "ล้างมือ", exEn: "Wash your hands before lunch.", exTh: "ล้างมือก่อนกินข้าวเที่ยง" },
  {"phrase":"clean the kitchen","th":"ทำความสะอาดครัว","exEn":"Clean the kitchen after lunch.","exTh":"ทำความสะอาดครัวหลังอาหารกลางวัน"},
  { phrase: "cook dinner", th: "ทำอาหารเย็น", exEn: "Mom cooks dinner nightly.", exTh: "แม่ทำอาหารเย็นทุกคืน" },
  { phrase: "buy some milk", th: "ซื้อนม", exEn: "Buy some milk at the store.", exTh: "ซื้อนมที่ร้าน" },
  { phrase: "drink tea", th: "ดื่มชา", exEn: "Grandma drinks tea daily.", exTh: "คุณยายดื่มชาทุกวัน" },
  {"phrase":"ride a horse","th":"ขี่ม้า","exEn":"She rides a horse on Sunday.","exTh":"เธอขี่ม้าวันอาทิตย์"},
  { phrase: "run fast", th: "วิ่งเร็ว", exEn: "He can run fast.", exTh: "เขาวิ่งได้เร็ว" },
  { phrase: "write a letter", th: "เขียนจดหมาย", exEn: "She writes a letter monthly.", exTh: "เธอเขียนจดหมายทุกเดือน" },
  { phrase: "sing a song", th: "ร้องเพลง", exEn: "They sing a song together.", exTh: "พวกเขาร้องเพลงด้วยกัน" },
  { phrase: "draw a picture", th: "วาดรูป", exEn: "Draw a picture for me.", exTh: "วาดรูปให้ฉันหน่อย" },
  { phrase: "speak English", th: "พูดภาษาอังกฤษ", exEn: "We speak English in class.", exTh: "พวกเราพูดภาษาอังกฤษในห้องเรียน" },
  { phrase: "answer the phone", th: "รับโทรศัพท์", exEn: "Answer the phone quickly.", exTh: "รับโทรศัพท์เร็วๆ" },
  { phrase: "ask a question", th: "ถามคำถาม", exEn: "Ask a question politely.", exTh: "ถามคำถามอย่างสุภาพ" },
  { phrase: "have a good time", th: "ใช้เวลาอย่างสนุก", exEn: "Have a good time at the party.", exTh: "ขอให้สนุกกับงานปาร์ตี้" },
  { phrase: "take a shower", th: "อาบน้ำ", exEn: "Take a shower at night.", exTh: "อาบน้ำตอนกลางคืน" },
  { phrase: "wake up late", th: "ตื่นสาย", exEn: "Do not wake up late.", exTh: "อย่าตื่นสาย" },
  { phrase: "work hard", th: "ทำงานหนัก", exEn: "They work hard every day.", exTh: "พวกเขาทำงานหนักทุกวัน" }
];

const VOCAB_EXTRA_COLLOC_A2 = [
  [{ phrase: "make a plan", th: "วางแผน", exEn: "Let's make a plan for the trip.", exTh: "มาวางแผนสำหรับการเดินทางกัน" }, { phrase: "spend money", th: "ใช้จ่ายเงิน", exEn: "Don't spend money carelessly.", exTh: "อย่าใช้จ่ายเงินอย่างไม่รอบคอบ" }],
  [{ phrase: "take a photo", th: "ถ่ายรูป", exEn: "Take a photo of the museum.", exTh: "ถ่ายรูปพิพิธภัณฑ์" }, {"phrase":"send a text message","th":"ส่งข้อความ","exEn":"Send a text message to mom.","exTh":"ส่งข้อความถึงแม่"}],
  [{ phrase: "catch a cold", th: "เป็นหวัด", exEn: "I caught a cold yesterday.", exTh: "ฉันเป็นหวัดเมื่อวาน" }, { phrase: "feel better", th: "รู้สึกดีขึ้น", exEn: "Rest and feel better soon.", exTh: "พักผ่อนและหายไวๆ" }],
  [{ phrase: "book a hotel", th: "จองโรงแรม", exEn: "Book a hotel near the beach.", exTh: "จองโรงแรมใกล้ชายหาด" }, {"phrase":"check out","th":"เช็คเอาต์","exEn":"Check out by noon.","exTh":"เช็คเอาต์ก่อนเที่ยง"}],
  [{ phrase: "miss the train", th: "พลาดรถไฟ", exEn: "Hurry or we miss the train.", exTh: "รีบหน่อย ไม่งั้นเราจะพลาดรถไฟ" }, { phrase: "wait for", th: "รอคอย", exEn: "We waited for the bus.", exTh: "พวกเรารอรถบัส" }],
  [{ phrase: "meet friends", th: "พบเพื่อน", exEn: "I meet friends every weekend.", exTh: "ฉันพบเพื่อนทุกสุดสัปดาห์" }, { phrase: "have a rest", th: "พักผ่อน", exEn: "Have a rest after work.", exTh: "พักผ่อนหลังเลิกงาน" }],
  [{ phrase: "learn a language", th: "เรียนภาษา", exEn: "She learns a language online.", exTh: "เธอเรียนภาษาทางออนไลน์" }, { phrase: "practice speaking", th: "ฝึกพูด", exEn: "Practice speaking daily.", exTh: "ฝึกพูดทุกวัน" }],
  [{ phrase: "order food", th: "สั่งอาหาร", exEn: "Order food at the counter.", exTh: "สั่งอาหารที่เคาน์เตอร์" }, { phrase: "pay the bill", th: "จ่ายบิล", exEn: "Pay the bill before leaving.", exTh: "จ่ายบิลก่อนออกจากร้าน" }],
  [{"phrase":"go sightseeing","th":"เที่ยวชมสถานที่","exEn":"We go sightseeing downtown.","exTh":"เราเที่ยวชมสถานที่ในตัวเมือง"}, { phrase: "try on clothes", th: "ลองเสื้อผ้า", exEn: "Try on clothes before buying.", exTh: "ลองเสื้อผ้าก่อนซื้อ" }],
  [{ phrase: "borrow a book", th: "ยืมหนังสือ", exEn: "Borrow a book from the library.", exTh: "ยืมหนังสือจากห้องสมุด" }, { phrase: "return it on time", th: "คืนให้ทันเวลา", exEn: "Return it on time.", exTh: "คืนให้ทันเวลา" }],
  [{ phrase: "give a present", th: "ให้ของขวัญ", exEn: "Give a present to your friend.", exTh: "ให้ของขวัญแก่เพื่อนของคุณ" }, { phrase: "open the gift", th: "เปิดของขวัญ", exEn: "Open the gift carefully.", exTh: "เปิดของขวัญอย่างระมัดระวัง" }],
  [{ phrase: "cook a meal", th: "ทำอาหาร", exEn: "Cook a meal for the family.", exTh: "ทำอาหารให้ครอบครัว" }, { phrase: "set the table", th: "จัดโต๊ะ", exEn: "Set the table for dinner.", exTh: "จัดโต๊ะสำหรับอาหารเย็น" }],
  [{ phrase: "look for", th: "ค้นหา", exEn: "Look for your keys carefully.", exTh: "ค้นหากุญแจให้ดี" }, { phrase: "find out", th: "ค้นพบ", exEn: "Find out the truth.", exTh: "ค้นหาความจริงให้เจอ" }],
  [{ phrase: "turn on", th: "เปิดเครื่อง", exEn: "Turn on the computer.", exTh: "เปิดคอมพิวเตอร์" }, { phrase: "turn off", th: "ปิดเครื่อง", exEn: "Turn off the lights.", exTh: "ปิดไฟ" }],
  [{ phrase: "put on", th: "สวมใส่", exEn: "Put on your coat.", exTh: "สวมเสื้อโค้ทของคุณ" }, { phrase: "take off", th: "ถอดออก", exEn: "Take off your shoes.", exTh: "ถอดรองเท้าของคุณ" }],
  [{ phrase: "wake up early", th: "ตื่นเช้า", exEn: "Wake up early to study.", exTh: "ตื่นเช้าเพื่ออ่านหนังสือ" }, { phrase: "stay up late", th: "นอนดึก", exEn: "Do not stay up late.", exTh: "อย่านอนดึก" }],
  [{ phrase: "look after", th: "ดูแล", exEn: "Look after your little sister.", exTh: "ดูแลน้องสาวของคุณ" }, { phrase: "care for", th: "ดูแลเอาใจใส่", exEn: "Care for the plants daily.", exTh: "ดูแลต้นไม้ทุกวัน" }],
  [{ phrase: "get ready", th: "เตรียมตัว", exEn: "Get ready for school.", exTh: "เตรียมตัวไปโรงเรียน" }, { phrase: "be late for", th: "มาสาย", exEn: "Do not be late for class.", exTh: "อย่ามาสายในชั้นเรียน" }],
  [{ phrase: "go abroad", th: "ไปต่างประเทศ", exEn: "She went abroad to study.", exTh: "เธอไปเรียนที่ต่างประเทศ" }, { phrase: "come back", th: "กลับมา", exEn: "Come back before dark.", exTh: "กลับมาก่อนมืด" }],
  [{ phrase: "ask for help", th: "ขอความช่วยเหลือ", exEn: "Ask for help when needed.", exTh: "ขอความช่วยเหลือเมื่อจำเป็น" }, { phrase: "give advice", th: "ให้คำแนะนำ", exEn: "Give advice to the young.", exTh: "ให้คำแนะนำแก่คนรุ่นใหม่" }],
  [{ phrase: "make a decision", th: "ตัดสินใจ", exEn: "Make a decision quickly.", exTh: "ตัดสินใจอย่างรวดเร็ว" }, { phrase: "change your mind", th: "เปลี่ยนใจ", exEn: "She changed her mind.", exTh: "เธอเปลี่ยนใจ" }],
  [{ phrase: "take a break", th: "พักเบรก", exEn: "Take a break for ten minutes.", exTh: "พักเบรกสิบนาที" }, { phrase: "keep going", th: "ก้าวต่อไป", exEn: "Keep going, you can do it.", exTh: "ก้าวต่อไป เธอทำได้" }],
  [{ phrase: "get lost", th: "หลงทาง", exEn: "We got lost in the city.", exTh: "พวกเราหลงทางในเมือง" }, { phrase: "ask the way", th: "ถามทาง", exEn: "Ask the way at the corner.", exTh: "ถามทางตรงหัวมุมถนน" }],
  [{ phrase: "save money", th: "เก็บเงิน", exEn: "Save money for the future.", exTh: "เก็บเงินเพื่ออนาคต" }, { phrase: "earn a living", th: "หาเลี้ยงชีพ", exEn: "He earns a living as a driver.", exTh: "เขาหาเลี้ยงชีพด้วยการเป็นคนขับรถ" }],
  [{ phrase: "join a club", th: "เข้าร่วมชมรม", exEn: "Join a club at school.", exTh: "เข้าร่วมชมรมที่โรงเรียน" }, { phrase: "make friends", th: "ผูกมิตร", exEn: "Make friends with classmates.", exTh: "ผูกมิตรกับเพื่อนร่วมชั้น" }],
  [{ phrase: "lose weight", th: "ลดน้ำหนัก", exEn: "He wants to lose weight.", exTh: "เขาอยากลดน้ำหนัก" }, { phrase: "keep fit", th: "รักษาร่างกายให้แข็งแรง", exEn: "Exercise to keep fit.", exTh: "ออกกำลังกายเพื่อสุขภาพที่ดี" }],
  [{ phrase: "break the rules", th: "ฝ่าฝืนกฎ", exEn: "Do not break the rules.", exTh: "อย่าฝ่าฝืนกฎ" }, { phrase: "follow the rules", th: "ปฏิบัติตามกฎ", exEn: "Follow the school rules.", exTh: "ปฏิบัติตามกฎของโรงเรียน" }],
  [{ phrase: "grow up", th: "เติบโต", exEn: "Children grow up fast.", exTh: "เด็กๆ เติบโตอย่างรวดเร็ว" }, { phrase: "move house", th: "ย้ายบ้าน", exEn: "They moved house last month.", exTh: "พวกเขาย้ายบ้านเมื่อเดือนที่แล้ว" }],
  [{ phrase: "get along with", th: "เข้ากันได้กับ", exEn: "Get along with your team.", exTh: "เข้ากันได้กับทีมของคุณ" }, { phrase: "work together", th: "ทำงานร่วมกัน", exEn: "Work together on the project.", exTh: "ทำงานร่วมกันในโปรเจกต์" }],
  [{ phrase: "enjoy the trip", th: "เพลิดเพลินกับการเดินทาง", exEn: "Enjoy the trip to the coast.", exTh: "เพลิดเพลินกับการเดินทางไปทะเล" }, { phrase: "take notes", th: "จดบันทึก", exEn: "Take notes during the lesson.", exTh: "จดบันทึกระหว่างเรียน" }]
];

window.VOCAB_EXTRA_COLLOC_A1 = VOCAB_EXTRA_COLLOC_A1;
window.VOCAB_EXTRA_COLLOC_A2 = VOCAB_EXTRA_COLLOC_A2;