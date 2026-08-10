import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import { PrismaClient, type Prisma } from "@prisma/client";

// Load the shared root .env whether run from the repo root or packages/db.
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(here, "../../../.env") });

const prisma = new PrismaClient();

const RESET = process.argv.includes("--reset");

// A known dev login — printed after seeding.
const SEED_USER_EMAIL = "buyer@meridian.test";
const SEED_USER_PASSWORD = "Password123!";

function gstinFor(stateCode: string, pan: string): string {
  // Format-plausible GSTIN: <state><PAN>1Z5 (15 chars). Not a real checksum.
  return `${stateCode}${pan}1Z5`;
}

type SeedVendor = {
  legalName: string;
  pan: string;
  stateCode: string;
  contactEmail: string;
  city: string;
  state: string;
  processTags: string[];
  certificationTags: string[];
  badgeState: "VERIFIED" | "LISTED";
};

const directoryVendors: SeedVendor[] = [
  { legalName: "Chakan Precision Castings Pvt Ltd", pan: "AABCC1234A", stateCode: "27", contactEmail: "sales@chakanprecision.test", city: "Chakan", state: "Maharashtra", processTags: ["HPDC", "Gravity Casting"], certificationTags: ["IATF 16949", "ISO 9001"], badgeState: "VERIFIED" },
  { legalName: "Pune AutoForge Industries", pan: "AAECP2345B", stateCode: "27", contactEmail: "contact@puneautoforge.test", city: "Pune", state: "Maharashtra", processTags: ["Forging", "Heat Treatment"], certificationTags: ["IATF 16949"], badgeState: "VERIFIED" },
  { legalName: "Oragadam Machined Components", pan: "AADCO3456C", stateCode: "33", contactEmail: "info@oragadammachined.test", city: "Oragadam", state: "Tamil Nadu", processTags: ["CNC Turning", "VMC"], certificationTags: ["IATF 16949", "ISO 14001"], badgeState: "VERIFIED" },
  { legalName: "Chennai Sheetmetal Works", pan: "AAFCC4567D", stateCode: "33", contactEmail: "rfq@chennaisheetmetal.test", city: "Chennai", state: "Tamil Nadu", processTags: ["Sheet Metal"], certificationTags: ["ISO 9001"], badgeState: "VERIFIED" },
  { legalName: "Manesar Die Casting Co", pan: "AAGCM5678E", stateCode: "06", contactEmail: "sales@manesardiecasting.test", city: "Manesar", state: "Haryana", processTags: ["HPDC"], certificationTags: ["IATF 16949", "ISO 9001", "ISO 14001"], badgeState: "VERIFIED" },
  { legalName: "Gurgaon Plating Solutions", pan: "AAHCG6789F", stateCode: "06", contactEmail: "ops@gurgaonplating.test", city: "Manesar", state: "Haryana", processTags: ["Plating", "Heat Treatment"], certificationTags: ["ISO 9001"], badgeState: "LISTED" },
  { legalName: "Rajkot Turned Parts Pvt Ltd", pan: "AAJCR7890G", stateCode: "24", contactEmail: "enquiry@rajkotturned.test", city: "Rajkot", state: "Gujarat", processTags: ["CNC Turning"], certificationTags: ["IATF 16949"], badgeState: "VERIFIED" },
  { legalName: "Saurashtra Forgings Ltd", pan: "AAKCS8901H", stateCode: "24", contactEmail: "sales@saurashtraforgings.test", city: "Rajkot", state: "Gujarat", processTags: ["Forging"], certificationTags: ["IATF 16949", "ISO 9001"], badgeState: "VERIFIED" },
  { legalName: "Coimbatore Casting & Machining", pan: "AALCC9012J", stateCode: "33", contactEmail: "info@cbecasting.test", city: "Coimbatore", state: "Tamil Nadu", processTags: ["Gravity Casting", "VMC"], certificationTags: ["ISO 9001", "ISO 14001"], badgeState: "VERIFIED" },
  { legalName: "Kovai Precision Engineering", pan: "AAMCK0123K", stateCode: "33", contactEmail: "quotes@kovaiprecision.test", city: "Coimbatore", state: "Tamil Nadu", processTags: ["CNC Turning", "VMC"], certificationTags: ["IATF 16949"], badgeState: "VERIFIED" },
  { legalName: "Ludhiana Auto Components", pan: "AANCL1234L", stateCode: "03", contactEmail: "sales@ludhianaauto.test", city: "Ludhiana", state: "Punjab", processTags: ["Sheet Metal", "Plating"], certificationTags: ["ISO 9001"], badgeState: "VERIFIED" },
  { legalName: "Punjab Fasteners & Forgings", pan: "AAPCP2345M", stateCode: "03", contactEmail: "info@punjabfasteners.test", city: "Ludhiana", state: "Punjab", processTags: ["Forging", "Heat Treatment"], certificationTags: ["IATF 16949", "ISO 9001"], badgeState: "VERIFIED" },
  { legalName: "Deccan Alloy Castings", pan: "AAQCD3456N", stateCode: "27", contactEmail: "sales@deccanalloy.test", city: "Pune", state: "Maharashtra", processTags: ["Gravity Casting", "HPDC"], certificationTags: ["ISO 9001"], badgeState: "VERIFIED" },
  { legalName: "Bharat Heat Treat Services", pan: "AARCB4567P", stateCode: "27", contactEmail: "ops@bharatheattreat.test", city: "Chakan", state: "Maharashtra", processTags: ["Heat Treatment"], certificationTags: ["ISO 9001", "ISO 14001"], badgeState: "LISTED" },
  { legalName: "Southern Machined Systems", pan: "AASCS5678Q", stateCode: "33", contactEmail: "rfq@southernmachined.test", city: "Chennai", state: "Tamil Nadu", processTags: ["VMC", "CNC Turning"], certificationTags: ["IATF 16949", "ISO 9001"], badgeState: "VERIFIED" },
  { legalName: "Aravalli Sheet Metal Pvt Ltd", pan: "AATCA6789R", stateCode: "06", contactEmail: "sales@aravallisheet.test", city: "Manesar", state: "Haryana", processTags: ["Sheet Metal"], certificationTags: ["ISO 9001"], badgeState: "VERIFIED" },
  { legalName: "Gujarat Precision Forge", pan: "AAUCG7890S", stateCode: "24", contactEmail: "info@gujaratforge.test", city: "Rajkot", state: "Gujarat", processTags: ["Forging", "VMC"], certificationTags: ["IATF 16949"], badgeState: "VERIFIED" },
  { legalName: "Kongu Plating Industries", pan: "AAVCK8901T", stateCode: "33", contactEmail: "sales@konguplating.test", city: "Coimbatore", state: "Tamil Nadu", processTags: ["Plating"], certificationTags: ["ISO 9001", "ISO 14001"], badgeState: "VERIFIED" },
];

async function main(): Promise<void> {
  if (RESET) {
    // Truncate all app tables so a re-run yields exactly the seed set.
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Invitation","Candidate","Requirement","DirectoryVendor","BuyerUser","BuyerOrg" RESTART IDENTITY CASCADE',
    );
    console.log("[seed] --reset: truncated all app tables");
  }

  // Org (idempotent by legal name).
  let org = await prisma.buyerOrg.findFirst({ where: { legalName: "Meridian Motors" } });
  if (!org) {
    org = await prisma.buyerOrg.create({ data: { legalName: "Meridian Motors" } });
  }

  // Login user (idempotent by unique email).
  const passwordHash = await bcrypt.hash(SEED_USER_PASSWORD, 12);
  const user = await prisma.buyerUser.upsert({
    where: { email: SEED_USER_EMAIL },
    update: { passwordHash, orgId: org.id, fullName: "Priya Sharma", role: "buyer" },
    create: { email: SEED_USER_EMAIL, passwordHash, orgId: org.id, fullName: "Priya Sharma", role: "buyer" },
  });

  // Directory vendors (skip if already populated, unless reset cleared them).
  const existingVendors = await prisma.directoryVendor.count();
  if (existingVendors === 0) {
    await prisma.directoryVendor.createMany({
      data: directoryVendors.map((v) => ({
        legalName: v.legalName,
        pan: v.pan,
        primaryGstin: gstinFor(v.stateCode, v.pan),
        contactEmail: v.contactEmail,
        city: v.city,
        state: v.state,
        processTags: v.processTags,
        certificationTags: v.certificationTags,
        badgeState: v.badgeState,
      })),
    });
  }
  const vendors = await prisma.directoryVendor.findMany({ orderBy: { createdAt: "asc" } });

  // Requirements — one per stage. Skip if already populated.
  const existingReqs = await prisma.requirement.count();
  if (existingReqs === 0) {
    await seedRequirements(org.id, user.id, vendors);
  }

  const [orgCount, vendorCount, reqCount, candCount, inviteCount] = await Promise.all([
    prisma.buyerOrg.count(),
    prisma.directoryVendor.count(),
    prisma.requirement.count(),
    prisma.candidate.count(),
    prisma.invitation.count(),
  ]);

  console.log("\n[seed] done:");
  console.log(`  orgs=${orgCount} vendors=${vendorCount} requirements=${reqCount} candidates=${candCount} invitations=${inviteCount}`);
  console.log("\n[seed] Login with:");
  console.log(`  email:    ${SEED_USER_EMAIL}`);
  console.log(`  password: ${SEED_USER_PASSWORD}\n`);
}

type Vendor = Awaited<ReturnType<PrismaClient["directoryVendor"]["findMany"]>>[number];

// Snapshot a directory vendor's fields into a candidate (org added at call site).
function candidateFromVendor(
  v: Vendor,
  invited: boolean,
): Omit<Prisma.CandidateCreateWithoutRequirementInput, "org"> {
  return {
    source: "DIRECTORY",
    directoryVendor: { connect: { id: v.id } },
    legalName: v.legalName,
    contactEmail: v.contactEmail,
    pan: v.pan,
    gstin: v.primaryGstin,
    city: v.city,
    state: v.state,
    inviteStatus: invited ? "INVITED" : "NOT_INVITED",
  };
}

async function seedRequirements(orgId: string, ownerUserId: string, vendors: Vendor[]): Promise<void> {
  const withOrg = (
    c: Omit<Prisma.CandidateCreateWithoutRequirementInput, "org">,
  ): Prisma.CandidateCreateWithoutRequirementInput => ({ ...c, org: { connect: { id: orgId } } });

  // Create a requirement with its candidates, then generate an invitation row
  // for every candidate that is INVITED/OPENED (invitation→requirement is a
  // separate relation, so it must be wired explicitly with the known ids).
  async function createRequirement(
    data: Omit<Prisma.RequirementCreateInput, "org" | "owner">,
  ): Promise<void> {
    const req = await prisma.requirement.create({
      data: { ...data, org: { connect: { id: orgId } }, owner: { connect: { id: ownerUserId } } },
      include: { candidates: true },
    });
    for (const c of req.candidates) {
      if (c.inviteStatus === "INVITED" || c.inviteStatus === "OPENED") {
        const opened = c.inviteStatus === "OPENED";
        const token = crypto.randomBytes(32).toString("base64url");
        await prisma.invitation.create({
          data: {
            candidateId: c.id,
            requirementId: req.id,
            orgId,
            tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
            magicTokenPlain: token,
            email: c.contactEmail,
            expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            ...(opened ? { status: "OPENED" as const, openedAt: new Date() } : {}),
          },
        });
      }
    }
  }

  // 1) DRAFT — no candidates.
  await createRequirement({
    stage: "DRAFT",
    title: "Aluminium HPDC housings — EV inverter",
    partCategory: "Casting",
    processCategories: ["HPDC", "CNC Turning"],
    plantLocation: "Chakan Plant 2",
    targetAwardDate: new Date("2026-10-15"),
  });

  // 2) CANDIDATES_SELECTED — a couple of candidates, none invited.
  await createRequirement({
    stage: "CANDIDATES_SELECTED",
    title: "Forged steering knuckles",
    partCategory: "Forging",
    processCategories: ["Forging", "Machining"],
    plantLocation: "Manesar Plant 1",
    targetAwardDate: new Date("2026-11-01"),
    candidates: {
      create: [
        withOrg(candidateFromVendor(vendors[1], false)),
        withOrg(candidateFromVendor(vendors[7], false)),
        withOrg({
          source: "MANUAL", legalName: "Nashik Precision Turnings",
          contactEmail: "sales@nashikprecision.test", pan: "AAWCN9012U", city: "Nashik", state: "Maharashtra",
          inviteStatus: "NOT_INVITED",
        }),
      ],
    },
  });

  // 3) INVITES_SENT — candidates invited (invitations generated).
  await createRequirement({
    stage: "INVITES_SENT",
    title: "CNC-machined transmission shafts",
    partCategory: "Machining",
    processCategories: ["CNC Turning", "VMC"],
    plantLocation: "Oragadam Plant",
    targetAwardDate: new Date("2026-09-30"),
    candidates: {
      create: [
        withOrg(candidateFromVendor(vendors[2], true)),
        withOrg(candidateFromVendor(vendors[9], true)),
      ],
    },
  });

  // 4) IN_PROGRESS — invited, one candidate has opened its invite.
  await createRequirement({
    stage: "IN_PROGRESS",
    title: "Sheet-metal brackets & mounts",
    partCategory: "Sheet Metal",
    processCategories: ["Sheet Metal", "Plating"],
    plantLocation: "Ludhiana Plant",
    targetAwardDate: new Date("2026-09-10"),
    candidates: {
      create: [
        withOrg({ ...candidateFromVendor(vendors[10], true), inviteStatus: "OPENED" }),
        withOrg(candidateFromVendor(vendors[3], true)),
      ],
    },
  });

  // 5) CLOSED.
  await createRequirement({
    stage: "CLOSED",
    title: "Gravity-cast brake calipers (2025 program)",
    partCategory: "Casting",
    processCategories: ["Gravity Casting"],
    plantLocation: "Pune Plant 3",
    targetAwardDate: new Date("2026-06-01"),
    candidates: {
      create: [withOrg(candidateFromVendor(vendors[8], true))],
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
