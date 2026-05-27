import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// Prisma 5: enums live on the client object, not as named exports
const prisma = new PrismaClient();

// Re-declare enums inline so TypeScript is happy without generated types at parse time
const Role = { ADMIN: 'ADMIN', SALES: 'SALES', ACCOUNTANT: 'ACCOUNTANT' } as const;
const VehicleStatus = { AVAILABLE: 'AVAILABLE', PENDING: 'PENDING', SOLD: 'SOLD' } as const;
const AccountType = { ASSET: 'ASSET', LIABILITY: 'LIABILITY', EQUITY: 'EQUITY', REVENUE: 'REVENUE', EXPENSE: 'EXPENSE' } as const;
const NormalBalance = { DEBIT: 'DEBIT', CREDIT: 'CREDIT' } as const;
const ExpenseCategory = { RENT: 'RENT', INSURANCE: 'INSURANCE', ADVERTISING: 'ADVERTISING' } as const;

type AccountTypeVal = typeof AccountType[keyof typeof AccountType];
type NormalBalanceVal = typeof NormalBalance[keyof typeof NormalBalance];

async function upsertVehicleByVin(vin: string, create: any) {
  const existing = await prisma.vehicle.findFirst({ where: { vin, deletedAt: null } });
  if (existing) return prisma.vehicle.update({ where: { id: existing.id }, data: {} });
  return prisma.vehicle.create({ data: create });
}

async function main() {
  // ── Users ──────────────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@dealership.local' },
    update: {},
    create: { email: 'admin@dealership.local', fullName: 'Alex Admin', role: Role.ADMIN, supabaseUserId: null },
  });

  const salesA = await prisma.user.upsert({
    where: { email: 'sales1@dealership.local' },
    update: {},
    create: { email: 'sales1@dealership.local', fullName: 'Sam Sales', role: Role.SALES },
  });

  const salesB = await prisma.user.upsert({
    where: { email: 'sales2@dealership.local' },
    update: {},
    create: { email: 'sales2@dealership.local', fullName: 'Riley Rep', role: Role.SALES },
  });

  await prisma.user.upsert({
    where: { email: 'accountant@dealership.local' },
    update: {},
    create: { email: 'accountant@dealership.local', fullName: 'Pat Accountant', role: Role.ACCOUNTANT },
  });

  // ── Dealer settings ────────────────────────────────────────────────────────
  await prisma.dealerSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      dealerName: 'Sidereal Motors',
      province: 'ON',
      hstRate: new Decimal(0.13),
      defaultOmvicFee: new Decimal(75.00),
    },
  });

  // ── Chart of accounts ──────────────────────────────────────────────────────
  const coa: Array<{ code: string; name: string; type: AccountTypeVal; normalBalance: NormalBalanceVal; description?: string }> = [
    { code: '1000', name: 'Cash – operating account',       type: AccountType.ASSET,     normalBalance: NormalBalance.DEBIT },
    { code: '1010', name: 'Cash – savings',                 type: AccountType.ASSET,     normalBalance: NormalBalance.DEBIT },
    { code: '1100', name: 'Accounts receivable',            type: AccountType.ASSET,     normalBalance: NormalBalance.DEBIT },
    { code: '1150', name: 'A/R – financed deals',           type: AccountType.ASSET,     normalBalance: NormalBalance.DEBIT },
    { code: '1200', name: 'Vehicle inventory',              type: AccountType.ASSET,     normalBalance: NormalBalance.DEBIT },
    { code: '1210', name: 'Reconditioning in progress',     type: AccountType.ASSET,     normalBalance: NormalBalance.DEBIT },
    { code: '1300', name: 'HST receivable (ITC)',           type: AccountType.ASSET,     normalBalance: NormalBalance.DEBIT, description: 'Input tax credits on purchases' },
    { code: '1500', name: 'Prepaid expenses',               type: AccountType.ASSET,     normalBalance: NormalBalance.DEBIT },
    { code: '1600', name: 'Office equipment',               type: AccountType.ASSET,     normalBalance: NormalBalance.DEBIT },
    { code: '2000', name: 'Accounts payable',               type: AccountType.LIABILITY, normalBalance: NormalBalance.CREDIT },
    { code: '2100', name: 'Accrued liabilities',            type: AccountType.LIABILITY, normalBalance: NormalBalance.CREDIT },
    { code: '2200', name: 'HST payable (collected)',        type: AccountType.LIABILITY, normalBalance: NormalBalance.CREDIT, description: 'HST collected on sales, owing to CRA' },
    { code: '2300', name: 'OMVIC fees payable',             type: AccountType.LIABILITY, normalBalance: NormalBalance.CREDIT },
    { code: '2400', name: 'Deposits held',                  type: AccountType.LIABILITY, normalBalance: NormalBalance.CREDIT },
    { code: '2500', name: 'Floorplan loan payable',         type: AccountType.LIABILITY, normalBalance: NormalBalance.CREDIT },
    { code: '2600', name: 'Bank loan payable',              type: AccountType.LIABILITY, normalBalance: NormalBalance.CREDIT },
    { code: '2700', name: 'Shareholder loan payable',       type: AccountType.LIABILITY, normalBalance: NormalBalance.CREDIT },
    { code: '3000', name: "Owner's equity / retained earnings", type: AccountType.EQUITY, normalBalance: NormalBalance.CREDIT },
    { code: '3100', name: "Owner's drawings",               type: AccountType.EQUITY,    normalBalance: NormalBalance.DEBIT },
    { code: '3200', name: 'Share capital',                  type: AccountType.EQUITY,    normalBalance: NormalBalance.CREDIT },
    { code: '4000', name: 'Vehicle sales revenue',          type: AccountType.REVENUE,   normalBalance: NormalBalance.CREDIT },
    { code: '4100', name: 'Safety & certification revenue', type: AccountType.REVENUE,   normalBalance: NormalBalance.CREDIT },
    { code: '4200', name: 'Warranty revenue',               type: AccountType.REVENUE,   normalBalance: NormalBalance.CREDIT },
    { code: '4300', name: 'OMVIC fee revenue',              type: AccountType.REVENUE,   normalBalance: NormalBalance.CREDIT },
    { code: '4400', name: 'Finance & insurance (F&I) income', type: AccountType.REVENUE, normalBalance: NormalBalance.CREDIT },
    { code: '4900', name: 'Other income',                   type: AccountType.REVENUE,   normalBalance: NormalBalance.CREDIT },
    { code: '5000', name: 'Cost of goods sold – vehicles',  type: AccountType.EXPENSE,   normalBalance: NormalBalance.DEBIT },
    { code: '5100', name: 'Reconditioning – safety & repairs', type: AccountType.EXPENSE, normalBalance: NormalBalance.DEBIT },
    { code: '5200', name: 'Reconditioning – detailing & cosmetic', type: AccountType.EXPENSE, normalBalance: NormalBalance.DEBIT },
    { code: '5300', name: 'Floorplan interest – inventory', type: AccountType.EXPENSE,   normalBalance: NormalBalance.DEBIT },
    { code: '5400', name: 'Gas & transport – inventory',    type: AccountType.EXPENSE,   normalBalance: NormalBalance.DEBIT },
    { code: '5500', name: 'Warranty cost – inventory',      type: AccountType.EXPENSE,   normalBalance: NormalBalance.DEBIT },
    { code: '6100', name: 'Advertising & marketing',        type: AccountType.EXPENSE,   normalBalance: NormalBalance.DEBIT },
    { code: '6200', name: 'Bank charges & fees',            type: AccountType.EXPENSE,   normalBalance: NormalBalance.DEBIT },
    { code: '6300', name: 'Floorplan interest – operating', type: AccountType.EXPENSE,   normalBalance: NormalBalance.DEBIT },
    { code: '6400', name: 'Insurance – business',           type: AccountType.EXPENSE,   normalBalance: NormalBalance.DEBIT },
    { code: '6500', name: 'Office supplies & expenses',     type: AccountType.EXPENSE,   normalBalance: NormalBalance.DEBIT },
    { code: '6600', name: 'OMVIC licence & fees',           type: AccountType.EXPENSE,   normalBalance: NormalBalance.DEBIT },
    { code: '6700', name: 'Rent & occupancy',               type: AccountType.EXPENSE,   normalBalance: NormalBalance.DEBIT },
    { code: '6800', name: 'Repairs & maintenance – premises', type: AccountType.EXPENSE, normalBalance: NormalBalance.DEBIT },
    { code: '6900', name: 'Salaries & wages',               type: AccountType.EXPENSE,   normalBalance: NormalBalance.DEBIT },
    { code: '7000', name: 'Utilities',                      type: AccountType.EXPENSE,   normalBalance: NormalBalance.DEBIT },
    { code: '7100', name: 'Miscellaneous expense',          type: AccountType.EXPENSE,   normalBalance: NormalBalance.DEBIT },
    { code: '7200', name: 'Depreciation',                   type: AccountType.EXPENSE,   normalBalance: NormalBalance.DEBIT },
    { code: '7300', name: 'Professional fees',              type: AccountType.EXPENSE,   normalBalance: NormalBalance.DEBIT },
    { code: '7400', name: 'Vehicle expense – dealership',   type: AccountType.EXPENSE,   normalBalance: NormalBalance.DEBIT },
  ];

  for (const row of coa) {
    await prisma.glAccount.upsert({
      where: { code: row.code },
      update: { name: row.name, description: row.description },
      create: row,
    });
  }

  // ── Sample vehicles ────────────────────────────────────────────────────────
  await upsertVehicleByVin('1HGCM82633A123456', {
    datePurchased: new Date('2025-01-10'), vin: '1HGCM82633A123456',
    year: 2019, make: 'Honda', model: 'Accord', trim: 'Sport', colour: 'Crystal Black',
    odometer: 48200, purchasePrice: 18500, safetyEstimate: 1200, safetyCost: 800,
    floorplanInterestCost: 210.5, gas: 60, warrantyCost: 450,
    status: VehicleStatus.AVAILABLE, salesPersonId: salesA.id, salesPersonName: salesA.fullName,
  });

  await upsertVehicleByVin('2T1BURHE0JC123456', {
    datePurchased: new Date('2024-11-02'), vin: '2T1BURHE0JC123456',
    year: 2018, make: 'Toyota', model: 'Corolla', trim: 'LE', colour: 'White',
    odometer: 61000, purchasePrice: 14250, safetyEstimate: 950, safetyCost: 700,
    floorplanInterestCost: 180, gas: 45, warrantyCost: 300,
    dateSold: new Date('2025-02-15'), sellingPrice: 16900, safetyCharge: 899,
    warrantyCharge: 650, omvicFee: 75, buyerName: 'Jordan Lee',
    referralAmount: 200, paymentMethod: 'Finance', depositAmount: 1500,
    status: VehicleStatus.SOLD, salesPersonId: salesB.id, salesPersonName: salesB.fullName,
  });

  await upsertVehicleByVin('5NPE24AF8FH123456', {
    datePurchased: new Date('2025-02-20'), vin: '5NPE24AF8FH123456',
    year: 2020, make: 'Hyundai', model: 'Elantra', trim: 'Preferred', colour: 'Phantom Black',
    odometer: 52000, purchasePrice: 13500, safetyEstimate: 600, safetyCost: 450,
    floorplanInterestCost: 95, gas: 40, warrantyCost: 200,
    sellingPrice: 16500, status: VehicleStatus.AVAILABLE,
    salesPersonId: salesA.id, salesPersonName: salesA.fullName,
  });

  // ── CRM ────────────────────────────────────────────────────────────────────
  let c1 = await prisma.customer.findFirst({ where: { fullName: 'Taylor Morgan', deletedAt: null } });
  if (!c1) c1 = await prisma.customer.create({ data: { fullName: 'Taylor Morgan', email: 'taylor@example.com', phone: '+1-555-0101' } });

  let c2 = await prisma.customer.findFirst({ where: { fullName: 'Casey Rivera', deletedAt: null } });
  if (!c2) c2 = await prisma.customer.create({ data: { fullName: 'Casey Rivera', email: 'casey@example.com', phone: '+1-555-0102' } });

  const honda = await prisma.vehicle.findFirst({ where: { vin: '1HGCM82633A123456', deletedAt: null } });

  if (honda) {
    await prisma.customerVehicle.upsert({
      where: { customerId_vehicleId: { customerId: c1.id, vehicleId: honda.id } },
      update: {},
      create: { customerId: c1.id, vehicleId: honda.id, role: 'INTERESTED' },
    });
  }

  if (await prisma.lead.count() === 0) {
    await prisma.lead.create({
      data: { fullName: 'Alex Prospect', phone: '+1-555-0199', email: 'alex.prospect@example.com',
        status: 'NEW_LEAD', source: 'WEB', summary: 'Asked about SUVs under $25k',
        customerId: c1.id, vehicleId: honda?.id ?? null },
    });
  }

  if (await prisma.deal.count() === 0) {
    await prisma.deal.create({
      data: { customerId: c2.id, vehicleId: honda?.id, title: 'Elantra follow-up', value: 16500, stage: 'PROPOSAL' },
    });
  }

  // ── Sample expenses ────────────────────────────────────────────────────────
  if (await prisma.expense.count() === 0) {
    const rentAcct  = await prisma.glAccount.findFirst({ where: { code: '6700' } });
    const insAcct   = await prisma.glAccount.findFirst({ where: { code: '6400' } });

    await prisma.expense.createMany({
      data: [
        {
          id: 'exp1', date: new Date('2025-03-01'), category: 'RENT',
          vendor: 'Landlord Inc', description: 'March lot rent',
          amountPreTax: new Decimal(2500), hstAmount: new Decimal(325),
          totalAmount: new Decimal(2825), glAccountId: rentAcct?.id,
        },
        {
          id: 'exp2', date: new Date('2025-03-05'), category: 'INSURANCE',
          vendor: 'Intact Insurance', description: 'Dealer liability insurance',
          amountPreTax: new Decimal(850), hstAmount: new Decimal(0),
          totalAmount: new Decimal(850), glAccountId: insAcct?.id,
        },
        {
          id: 'exp3', date: new Date('2025-03-10'), category: 'ADVERTISING',
          vendor: 'AutoTrader', description: 'AutoTrader listing subscription',
          amountPreTax: new Decimal(399), hstAmount: new Decimal(51.87),
          totalAmount: new Decimal(450.87),
        },
      ],
    });
  }

  console.log('✅ Seed complete. Admin user id:', admin.id);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
