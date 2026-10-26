import { db } from "@/db";
import { areas, items, users } from "@/db/schema";
import { addDays, dateISO } from "@/lib/utils";
import type { AreaColor, ItemData, ItemKind } from "@/lib/types";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function samplePdf(): string {
  const stream = "BT /F1 22 Tf 55 720 Td (ezlife26 - Car Service Estimate) Tj /F1 12 Tf 0 -45 Td (Annual vehicle service and safety inspection) Tj 0 -28 Td (Oil and filter change: EUR 95.00) Tj 0 -24 Td (Brake and tyre inspection: EUR 65.00) Tj 0 -24 Td (Labour and safety check: EUR 80.00) Tj 0 -40 Td (Total estimate: EUR 240.00) Tj 0 -50 Td (Demo document - not a real invoice.) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return `data:application/pdf;base64,${Buffer.from(pdf).toString("base64")}`;
}

export async function createSeededUser(name: string, email: string, passwordHash: string | null, isDemo: boolean) {
  return db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({ name, email, passwordHash, isDemo }).returning();
    await seedWorkspace(tx, user.id);
    return user;
  });
}

async function seedWorkspace(tx: Transaction, userId: string) {
  const definitions: { name: string; description: string; emoji: string; color: AreaColor }[] = [
    { name: "Mind", description: "Feed your mind", emoji: "🧠", color: "lavender" },
    { name: "Heart", description: "Feed your soul", emoji: "❤️", color: "rose" },
    { name: "Body", description: "Stay fit", emoji: "💪", color: "mint" },
    { name: "Family", description: "Kids & spouse", emoji: "👨‍👩‍👧", color: "peach" },
    { name: "Finance", description: "Save, invest, stay free", emoji: "💰", color: "blue" },
  ];
  const createdAreas = await tx.insert(areas).values(definitions.map((area, sortOrder) => ({ ...area, userId, sortOrder }))).returning();
  const areaId = (name: string) => createdAreas.find((area) => area.name === name)!.id;
  const today = dateISO();
  const rows: { userId: string; kind: ItemKind; title: string; areaId: string; data: ItemData; createdAt?: Date }[] = [];
  const target = (area: string, title: string, progress: number, offset: number, description: string) => {
    rows.push({ userId, kind: "target", title, areaId: areaId(area), data: { progress, completed: progress === 100, dueDate: addDays(today, offset), priority: "medium", description } });
  };
  target("Mind", "Make reading a daily ritual", 100, 7, "A few pages each day is all it takes. Finish one book this month.");
  target("Mind", "Finish Atomic Habits", 0, 14, "Explore small changes that make a remarkable difference.");
  target("Mind", "Learn conversational Spanish", 0, 45, "Practice for 15 minutes a day and feel confident ordering a coffee.");
  target("Heart", "Keep a gratitude journal", 100, 7, "Notice three good things, even on the ordinary days.");
  target("Heart", "Make time for yourself", 100, 14, "Schedule a little screen-free time, just for you.");
  target("Body", "Move for 30 minutes a day", 100, 7, "A walk, a stretch, a dance. It all counts.");
  target("Body", "Run my first 5K", 0, 60, "Follow a gentle training plan and enjoy the process.");
  target("Family", "Plan a family weekend", 100, 2, "A picnic, fresh air, and time with our favourite people.");
  target("Family", "Call Mum every Sunday", 100, 4, "Keep a little time for a proper catch-up.");
  target("Finance", "Build an emergency fund", 50, 90, "Save EUR 3,000 for peace of mind. Halfway there!");
  target("Finance", "Review monthly spending", 0, 5, "Look over subscriptions and give every euro a purpose.");

  const habit = (area: string, title: string, unit: string, streak: number, complete: boolean) => {
    const history = Array.from({ length: streak }, (_, i) => addDays(today, -i - (complete ? 0 : 1)));
    rows.push({ userId, kind: "habit", title, areaId: areaId(area), data: { unit, history, streak, description: "A small daily promise to yourself." } });
  };
  habit("Mind", "Read a few pages", "20 minutes", 7, true);
  habit("Body", "Move your body", "30 minutes", 12, true);
  habit("Heart", "A moment of gratitude", "3 good things", 9, true);
  habit("Body", "Drink enough water", "8 glasses", 5, false);

  const plan = (area: string, title: string, time: string, completed: boolean, duration: number, day = today) => {
    rows.push({ userId, kind: "plan", title, areaId: areaId(area), data: { date: day, time, completed, duration, description: "Make a little room for what matters." } });
  };
  plan("Body", "Morning stretch", "07:30", true, 15);
  plan("Mind", "A little reading time", "09:00", true, 30);
  plan("Family", "Family dinner", "18:30", false, 60);
  plan("Body", "A walk in the park", "08:00", false, 30, addDays(today, 1));
  plan("Finance", "Weekly money check-in", "17:00", false, 20, addDays(today, 1));
  const chore = (area: string, title: string, completed: boolean, description: string, day = today) => {
    rows.push({ userId, kind: "chore", title, areaId: areaId(area), data: { date: day, completed, description } });
  };
  chore("Family", "Take out the recycling", false, "Bins go out before the evening collection.");
  chore("Heart", "Water the houseplants", true, "The kitchen fern and the living-room pilea.");
  chore("Body", "Wipe the kitchen counters", false, "A two-minute reset after breakfast.");
  chore("Family", "Change the bed linen", false, "Fresh sheets for the weekend.", addDays(today, 1));

  const journal = "A few good things\n\nThe first sip of coffee. A sunny walk. A proper catch-up with Mum.\n\nThere's a lot to love in an ordinary day.\n";
  rows.push(
    { userId, kind: "file", title: "Family weekend.jpg", areaId: areaId("Family"), data: { mimeType: "image/jpeg", fileSize: 148640, url: "/images/family-picnic.jpg", description: "A sunny afternoon together in the park." }, createdAt: new Date(Date.now() - 3600000) },
    { userId, kind: "file", title: "Little moments.txt", areaId: areaId("Heart"), data: { mimeType: "text/plain", fileSize: Buffer.byteLength(journal), content: `data:text/plain;base64,${Buffer.from(journal).toString("base64")}`, description: "A little collection of things to be grateful for." }, createdAt: new Date(Date.now() - 172800000) },
    { userId, kind: "note", title: "A few things I'm grateful for", areaId: areaId("Heart"), data: { pinned: true, description: "The first sip of coffee. A sunny walk. A proper catch-up with Mum.\n\nThere's a lot to love in an ordinary day." } },
    { userId, kind: "note", title: "Books for a slower season", areaId: areaId("Mind"), data: { description: "1. Atomic Habits — James Clear\n2. The Creative Act — Rick Rubin\n3. Four Thousand Weeks — Oliver Burkeman\n\nLess scrolling, more turning pages." } },
    { userId, kind: "note", title: "Our next little adventure", areaId: areaId("Family"), data: { description: "Pack a picnic, bring the bikes, and head to the coast.\n\nRemember: sunscreen, a warm layer, and the good camera." } },
  );
  await tx.insert(items).values(rows);
}
