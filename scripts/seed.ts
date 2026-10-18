/**
 * Database seed — a working library on an empty database.
 *
 * Run with `npm run seed`. It is **idempotent**: re-running updates the same
 * documents instead of duplicating them, keyed on the unique fields the models
 * already declare (`email`, `slug`). `--dry-run` reports what it would write and
 * touches nothing.
 *
 * ## Why this uses the Mongoose models and not the raw driver
 *
 * Three of the collection's constraints are invisible in the TypeScript types and
 * cost real debugging time if a hand-written document misses them:
 *
 * - `User.membershipId` and `Book.isbn` are **sparse** unique indexes. A stored
 *   `null` is a *value* to a unique index, so staff documents and ISBN-less books
 *   must omit the key entirely (`data-model.md`). Writing `null` produces a bare
 *   `E11000` on the *second* such document, which reads as "that record already
 *   exists" for a record that does not exist yet.
 * - `Book.availableCopies` is guarded by a `pre("validate")` hook (invariant 5).
 * - A **fresh** Atlas cluster has no indexes at all, so `E11000` protection only
 *   exists once the models have been initialised. `Model.init()` below does that.
 *
 * ## Covers
 *
 * Book covers are real artwork fetched from Open Library by ISBN and uploaded
 * through the **same signed-upload pipeline the browser uses** (`signUpload()` from
 * `lib/cloudinary`), so a seeded book exercises the production path rather than a
 * privileged shortcut. A cover that cannot be fetched is simply omitted — the app
 * draws a typographic cover instead — and the book is reported as such.
 */
import * as fs from "node:fs";

/*
 * First import on purpose: it puts `.env.local` into `process.env` **before** the
 * app modules below are evaluated. `lib/db.ts` checks `MONGODB_URI` at import time,
 * and ESM evaluates imports in source order, so doing this inside `main()` would
 * already be too late. See `load-env.ts`.
 */
import { env } from "./load-env";

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import { signUpload } from "@/lib/cloudinary";
import { CLOUDINARY_PREFIX, UPLOAD_LIMITS } from "@/lib/cloudinary-shared";
import { Book } from "@/models/book";
import { Category } from "@/models/category";
import { User } from "@/models/user";
import { getSettings } from "@/lib/services/settings";
import type { CategoryColor } from "@/lib/constants";
import type { CategoryIconName } from "@/lib/validators/category";

/* -------------------------------------------------------------------------- */
/* Configuration                                                               */
/* -------------------------------------------------------------------------- */

const DRY_RUN = process.argv.includes("--dry-run");

/*
 * Credentials live in `.env.local`, never in this file — a seed that embeds an
 * admin password *and* a connection string is a credential leak waiting to be
 * committed. `load-env` has already put them into `process.env`; the parsed object
 * is imported for the one value needed before the first call.
 */
const uri = env.MONGODB_URI;

if (!uri) {
  console.error("MONGODB_URI is missing from .env.local. Nothing to seed.");
  process.exit(1);
}

/** The database comes from the URI, so the seed never guesses a name. */
const dbName = new URL(uri).pathname.replace(/^\//, "") || "lms";

/** Fixed so the seed is reproducible; matches `lib/auth/password.ts`. */
const BCRYPT_COST = 10;

const ADMIN = {
  name: "Athenaeum Administrator",
  email: "admin@gmail.com",
  password: "@Kashi1229",
  phone: "+1 555 0100",
  department: "Administration",
};

/** One shared password for the demo members, printed in the summary below. */
const MEMBER_PASSWORD = "Member@1234";

/* -------------------------------------------------------------------------- */
/* Data                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Six categories, one per accent colour in `CATEGORY_COLORS`.
 *
 * Typed rather than left to inference: with `as const` the `color` literal widens
 * through the array to `string`, and `Category.create` then rejects the whole
 * document as not matching `CategoryColor` — an error that points at the model
 * rather than at the seed.
 */
const CATEGORIES: Array<{
  name: string;
  icon: CategoryIconName;
  color: CategoryColor;
  description: string;
}> = [
  { name: "Fiction", icon: "BookOpen", color: "forest", description: "Novels, short stories and the written imagination." },
  { name: "Science", icon: "Atom", color: "ocean", description: "The natural world, from physics to biology." },
  { name: "Technology", icon: "Cpu", color: "slate", description: "Computing, engineering and how things are built." },
  { name: "History", icon: "ScrollText", color: "ochre", description: "Recorded human events and the ideas that shaped them." },
  { name: "Psychology", icon: "Lightbulb", color: "plum", description: "Mind, behaviour and decision-making." },
  { name: "Design", icon: "Palette", color: "terracotta", description: "Craft, visual systems and the designed world." },
];

const MEMBERS = [
  { name: "Amelia Rahman", email: "amelia.rahman@athenaeum.edu", department: "Comparative Literature", phone: "+1 555 0111" },
  { name: "Bilal Ahmed", email: "bilal.ahmed@athenaeum.edu", department: "Physics", phone: "+1 555 0112" },
  { name: "Chen Wei", email: "chen.wei@athenaeum.edu", department: "Computer Science", phone: "+1 555 0113" },
  { name: "Daniel Okafor", email: "daniel.okafor@athenaeum.edu", department: "History", phone: "+1 555 0114" },
  { name: "Elena Petrova", email: "elena.petrova@athenaeum.edu", department: "Psychology", phone: "+1 555 0115" },
  { name: "Farhan Iqbal", email: "farhan.iqbal@athenaeum.edu", department: "Graphic Design", phone: "+1 555 0116" },
  { name: "Grace Mensah", email: "grace.mensah@athenaeum.edu", department: "Molecular Biology", phone: "+1 555 0117" },
  { name: "Hana Suzuki", email: "hana.suzuki@athenaeum.edu", department: "Applied Mathematics", phone: "+1 555 0118" },
];

/** Real ISBNs, so Open Library can supply real artwork. */
const BOOKS = [
  { title: "Pride and Prejudice", authors: ["Jane Austen"], isbn: "9780141439518", category: "Fiction", publisher: "Penguin Classics", edition: "Reprint", publishedYear: 2002, pageCount: 279, copies: 4, shelf: "FIC-01", tags: ["classic", "romance", "austen"], summary: "An opinionated young woman and an equally proud gentleman learn to read each other correctly." },
  { title: "Matilda", authors: ["Roald Dahl"], isbn: "9780140328721", category: "Fiction", publisher: "Puffin", edition: "Illustrated", publishedYear: 2007, pageCount: 240, copies: 5, shelf: "FIC-02", tags: ["childrens", "dahl", "fantasy"], summary: "A gifted reader with terrible parents decides that reading is worth doing anyway." },
  { title: "Nineteen Eighty-Four", authors: ["George Orwell"], isbn: "9780451524935", category: "Fiction", publisher: "Signet", edition: "Centennial", publishedYear: 1961, pageCount: 328, copies: 3, shelf: "FIC-03", tags: ["dystopia", "orwell", "politics"], summary: "A surveillance state rewrites history, and one man tries to keep a private memory." },
  { title: "The Great Gatsby", authors: ["F. Scott Fitzgerald"], isbn: "9780743273565", category: "Fiction", publisher: "Scribner", edition: "Reissue", publishedYear: 2004, pageCount: 180, copies: 2, shelf: "FIC-04", tags: ["classic", "american", "jazz-age"], summary: "A narrator discovers what the green light at the end of the dock actually cost." },
  { title: "Frankenstein", authors: ["Mary Shelley"], isbn: "9780141439471", category: "Fiction", publisher: "Penguin", edition: "Revised", publishedYear: 2003, pageCount: 273, copies: 3, shelf: "FIC-05", tags: ["gothic", "classic", "early-science"], summary: "A creator answers to the thing he made, and cannot put it down." },
  { title: "Sapiens", authors: ["Yuval Noah Harari"], isbn: "9780062316097", category: "History", publisher: "Harper", edition: "First", publishedYear: 2015, pageCount: 443, copies: 4, shelf: "HIS-01", tags: ["anthropology", "civilisation", "popular-science"], summary: "How an unremarkable ape came to run the planet, in one sweep." },
  { title: "The Silk Roads", authors: ["Peter Frankopan"], isbn: "9781408839997", category: "History", publisher: "Bloomsbury", edition: "Reissue", publishedYear: 2015, pageCount: 573, copies: 2, shelf: "HIS-02", tags: ["geography", "trade", "world-history"], summary: "World history retold from the roads rather than the continents." },
  { title: "A Brief History of Time", authors: ["Stephen Hawking"], isbn: "9780553380163", category: "Science", publisher: "Bantam", edition: "Illustrated", publishedYear: 2014, pageCount: 212, copies: 3, shelf: "SCI-01", tags: ["cosmology", "hawking", "popular-science"], summary: "Black holes, the beginning of time, and why time is not what it looks like." },
  { title: "The Selfish Gene", authors: ["Richard Dawkins"], isbn: "9780198788607", category: "Science", publisher: "Oxford University Press", edition: "40th Anniversary", publishedYear: 2016, pageCount: 360, copies: 2, shelf: "SCI-02", tags: ["evolution", "genetics", "biology"], summary: "Evolution explained from the unit of selection upward." },
  { title: "Thinking, Fast and Slow", authors: ["Daniel Kahneman"], isbn: "9780374533557", category: "Psychology", publisher: "Farrar, Straus and Giroux", edition: "Reissue", publishedYear: 2011, pageCount: 499, copies: 3, shelf: "PSY-01", tags: ["decision-making", "behavioural", "cognition"], summary: "Two systems in the brain, and the predictable ways they fail us." },
  { title: "The Design of Everyday Things", authors: ["Donald A. Norman"], isbn: "9780465050659", category: "Design", publisher: "Basic Books", edition: "Revised", publishedYear: 2013, pageCount: 368, copies: 4, shelf: "DES-01", tags: ["ux", "usability", "classic"], summary: "Why so many doors are hard to open, and the principles that fix them." },
  { title: "Structure and Interpretation", authors: ["Noam Chomsky"], isbn: "9780262530871", category: "Technology", publisher: "MIT Press", edition: "Second", publishedYear: 1993, pageCount: 776, copies: 2, shelf: "TEC-01", tags: ["computing", "programming", "theory"], summary: "The founding text of formal-language theory and modern computing." },
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** `Pride and Prejudice` -> `pride-and-prejudice`, matching the books service. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * The next free `LIB-<year>-NNNN` id.
 *
 * Allocated against what is **actually in the collection** rather than assumed from
 * the array index: the seed is meant to run on a database that already holds
 * members, and starting at 0001 blindly produces a bare
 * `E11000 duplicate key … index: membershipId_1` on the first collision — which
 * reads as "that record already exists" for a record that does not exist yet.
 */
async function nextMembershipId(taken: Set<string>, index: number): Promise<string> {
  const prefix = `LIB-${new Date().getFullYear()}-`;

  let sequence = index + 1;
  while (taken.has(`${prefix}${String(sequence).padStart(4, "0")}`)) sequence++;
  return `${prefix}${String(sequence).padStart(4, "0")}`;
}

async function fetchCover(isbn: string): Promise<Buffer | null> {
  // `-L` is Open Library's large size. A missing cover is answered with a tiny
  // transparent placeholder, so a small body means "no artwork", not "an error".
  const response = await fetch(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return null;

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.length < 5_000 ? null : buffer;
}

/**
 * Upload one cover through the browser's own signed-upload pipeline.
 *
 * Reusing `signUpload()` means a seeded cover proves the signing fix works, and the
 * asset lands in the same `athenaeum/covers` prefix under the same 5MB cap that a
 * real upload does.
 */
async function uploadCover(isbn: string): Promise<{ url: string; publicId: string } | null> {
  const bytes = await fetchCover(isbn);
  if (!bytes) return null;

  const signed = await signUpload("covers");
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }), `${isbn}.jpg`);
  form.append("api_key", signed.apiKey);
  form.append("timestamp", String(signed.timestamp));
  form.append("signature", signed.signature);
  form.append("folder", signed.folder);
  form.append("allowed_formats", signed.allowedFormats);
  form.append("max_file_size", String(signed.maxFileSizeBytes));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });
  const payload = (await response.json()) as {
    public_id?: string;
    secure_url?: string;
    error?: { message?: string };
  };

  if (!response.ok || !payload.public_id) {
    console.warn(`  ! cover upload failed for ${isbn}: ${payload.error?.message ?? response.status}`);
    return null;
  }
  return { url: payload.secure_url ?? "", publicId: payload.public_id };
}

/* -------------------------------------------------------------------------- */
/* Seed                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Connect, falling back from SRV to the cluster's parent hostname.
 *
 * Some resolvers answer Atlas' SRV query with target names that do not belong to
 * the cluster's own domain (`ac-xxxx-shard-00-00` rather than
 * `*.shard-00-00.<region>.build.mongodb.net`). Both the driver and Mongoose reject
 * that outright — *"Server record does not share hostname with parent URI"* — and
 * they reject it **before** authenticating, so the error says nothing at all about
 * whether the credentials are usable.
 *
 * The parent hostname is the same cluster reached without SRV, so trying it second
 * turns a cryptic failure into the real one (an IP access-list problem, say).
 */
async function connectToDatabase(target: string): Promise<void> {
  const candidates = [target];

  if (target.startsWith("mongodb+srv://")) {
    const parent = target.replace("mongodb+srv://", "mongodb://");
    candidates.push(parent.includes("?") ? `${parent}&retryWrites=true` : `${parent}?retryWrites=true`);
  }

  const failures: string[] = [];

  for (const [index, candidate] of candidates.entries()) {
    try {
      await mongoose.connect(candidate, { serverSelectionTimeoutMS: 20_000 });
      if (index > 0) console.log("connected without SRV, using the cluster hostname directly\n");
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
      failures.push(`${candidate.startsWith("mongodb+srv") ? "SRV" : "hostname"}: ${message}`);
    }
  }

  throw new Error(`could not connect to MongoDB:\n  ${failures.join("\n  ")}`);
}

/* -------------------------------------------------------------------------- */
/* Seed                                                                        */
/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  if (DRY_RUN) console.log("DRY RUN — nothing will be written.\n");

  await connectToDatabase(uri);
  console.log(`connected to "${dbName}" at ${uri.replace(/\/\/[^@]+@/, "//***@")}\n`);

  // Indexes first: uniqueness is what makes the upserts below safe, and a fresh
  // Atlas cluster starts with none at all.
  for (const model of [User, Category, Book]) await model.init();
  console.log(`indexes ensured on ${[User, Category, Book].map((m) => m.collection.name).join(", ")}\n`);

  // Invariant 7: exactly one settings singleton, created with `SETTINGS_DEFAULTS`
  // on first call — so calling it *is* the seed.
  const settings = await getSettings();
  console.log(`settings singleton: "${settings.libraryName}" (${settings.currencyCode} ${settings.currencySymbol})\n`);

  /* ---------------------------- categories ---------------------------- */
  const categoryByName = new Map<string, mongoose.Types.ObjectId>();

  for (const entry of CATEGORIES) {
    const slug = slugify(entry.name);
    const existing = await Category.findOne({ slug }).lean();

    if (existing) {
      categoryByName.set(entry.name, existing._id as mongoose.Types.ObjectId);
      if (!DRY_RUN) await Category.updateOne({ _id: existing._id }, { $set: { ...entry, slug } });
      console.log(`  category ${entry.name.padEnd(11)} updated`);
      continue;
    }

    if (DRY_RUN) {
      categoryByName.set(entry.name, new mongoose.Types.ObjectId());
      console.log(`  category ${entry.name.padEnd(11)} would be created`);
      continue;
    }

    const created = await Category.create({ ...entry, slug });
    categoryByName.set(entry.name, created._id as mongoose.Types.ObjectId);
    console.log(`  category ${entry.name.padEnd(11)} created`);
  }

  /* ------------------------------ admin ------------------------------ */
  const adminEmail = ADMIN.email.toLowerCase();
  const adminHash = await bcrypt.hash(ADMIN.password, BCRYPT_COST);
  const existingAdmin = await User.findOne({ email: adminEmail }).lean();

  if (existingAdmin) {
    if (!DRY_RUN) {
      await User.updateOne(
        { _id: existingAdmin._id },
        {
          $set: {
            name: ADMIN.name,
            role: "admin",
            status: "active",
            phone: ADMIN.phone,
            department: ADMIN.department,
            // `passwordHash` is `select: false`, so it cannot be set through a
            // normal field write — `strict: false` is required here.
            passwordHash: adminHash,
          },
          // A staff account must not carry a membership id: the index is sparse,
          // so a stored value would collide with every other staff record.
          $unset: { membershipId: "" },
        },
        { strict: false },
      );
    }
    console.log(`  admin ${adminEmail} reset`);
  } else if (DRY_RUN) {
    console.log(`  admin ${adminEmail} would be created`);
  } else {
    await User.create({
      name: ADMIN.name,
      email: adminEmail,
      passwordHash: adminHash,
      role: "admin",
      status: "active",
      phone: ADMIN.phone,
      department: ADMIN.department,
      // membershipId intentionally omitted — see above.
    });
    console.log(`  admin ${adminEmail} created`);
  }

  /* ----------------------------- members ----------------------------- */
  const memberHash = await bcrypt.hash(MEMBER_PASSWORD, BCRYPT_COST);
  const takenIds = new Set((await User.distinct("membershipId")).filter(Boolean) as string[]);
  let memberCount = 0;

  for (const [index, member] of MEMBERS.entries()) {
    const email = member.email.toLowerCase();
    memberCount++;

    if (await User.findOne({ email }).lean()) {
      console.log(`  member ${member.name.padEnd(16)} already present`);
      continue;
    }

    const id = await nextMembershipId(takenIds, index);

    if (DRY_RUN) {
      console.log(`  member ${member.name.padEnd(16)} would be created (${id})`);
      continue;
    }

    await User.create({
      name: member.name,
      email,
      passwordHash: memberHash,
      role: "member",
      status: "active",
      membershipId: id,
      phone: member.phone,
      department: member.department,
    });
    takenIds.add(id);
    console.log(`  member ${member.name.padEnd(16)} created (${id})`);
  }

  /* ------------------------------ books ------------------------------ */
  const admin = await User.findOne({ email: adminEmail }).lean();
  let withCover = 0;
  let withoutCover = 0;

  for (const book of BOOKS) {
    const slug = slugify(book.title);
    const categoryId = categoryByName.get(book.category);
    if (!categoryId) throw new Error(`Unknown category "${book.category}" for "${book.title}".`);

    if (await Book.findOne({ slug }).lean()) {
      console.log(`  book ${book.title.padEnd(32)} already present`);
      continue;
    }

    let cover: { url: string; publicId: string } | null = null;
    if (!DRY_RUN) cover = await uploadCover(book.isbn);
    if (cover) withCover++;
    else if (!DRY_RUN) withoutCover++;

    if (DRY_RUN) {
      console.log(`  book ${book.title.padEnd(32)} would be created`);
      continue;
    }

    await Book.create({
      title: book.title,
      slug,
      authors: book.authors,
      // Only written when it exists — see the sparse-index note at the top.
      ...(book.isbn ? { isbn: book.isbn } : {}),
      publisher: book.publisher,
      edition: book.edition,
      publishedYear: book.publishedYear,
      language: "English",
      category: categoryId,
      tags: book.tags,
      description: `${book.title} by ${book.authors.join(", ")}. ${book.summary}`,
      pageCount: book.pageCount,
      cover,
      shelfLocation: book.shelf,
      totalCopies: book.copies,
      availableCopies: book.copies,
      status: "active",
      addedBy: admin?._id ?? null,
    });

    console.log(
      cover
        ? `  book ${book.title.padEnd(32)} created with cover art`
        : `  book ${book.title.padEnd(32)} created (no published cover for that ISBN)`,
    );
  }

  /* ------------------------------ summary ---------------------------- */
  console.log("\n------------------------------------------------------------");
  console.log(`  categories  ${CATEGORIES.length}`);
  console.log(`  admin       1`);
  console.log(`  members     ${memberCount}`);
  console.log(`  books       ${BOOKS.length}  (${withCover} with cover art, ${withoutCover} without)`);
  console.log("------------------------------------------------------------");
  console.log(`  admin login   ${ADMIN.email} / ${ADMIN.password}`);
  console.log(`  member login  ${MEMBERS[0].email} / ${MEMBER_PASSWORD}`);
  console.log(`                 (the same password for all ${MEMBERS.length} seeded members)`);
  console.log("------------------------------------------------------------");
  console.log(`  covers sit under ${CLOUDINARY_PREFIX}/covers, capped at ${UPLOAD_LIMITS.covers.maxSizeMB}MB each.`);
  console.log("");

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("\nseed failed:", error instanceof Error ? error.message : error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});