/**
 * End-to-end API suite for the Harshit Education Center platform.
 *
 * The real Express app is booted on an ephemeral port and driven over HTTP with
 * the global `fetch`, so middleware, routers, Mongoose models and the local
 * storage adapter are all exercised exactly as they run in production.
 *
 * It uses Node's built-in test runner (`node --test`) together with `tsx`, so the
 * project needs no additional test framework dependency.
 *
 * Run with: npm run test --workspace server
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import mongoose from 'mongoose';

/**
 * The suite runs against its own throwaway database and must never touch the
 * development data seeded by `npm run seed`. `config/env.ts` parses
 * `process.env` at import time, so these have to be set before the first
 * dynamic import of an application module.
 */
const TEST_DATABASE = 'harshit_education_e2e';
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = `mongodb://127.0.0.1:27017/${TEST_DATABASE}`;
process.env.JWT_SECRET = 'e2e-suite-secret-at-least-32-characters-long';
process.env.STORAGE_PROVIDER = 'local';

const { app } = await import('../app.js');
const { connectDatabase, disconnectDatabase } = await import('../config/db.js');
const { User, hashPassword } = await import('../models/User.js');
const { Material } = await import('../models/Material.js');
const { Subject } = await import('../models/Subject.js');
const { Board } = await import('../models/Board.js');
const { StudentProfile } = await import('../models/StudentProfile.js');
const { TeacherProfile } = await import('../models/TeacherProfile.js');
const { Settings } = await import('../models/Settings.js');
const { uploadDirectory } = await import('../middleware/upload.js');
const { clientIndexFile, clientDistDirectory } = await import('../config/paths.js');

const STUDENT_PASSWORD = 'Student@12345';
const TEACHER_PASSWORD = 'Teacher@12345';
const ADMIN_PASSWORD = 'Admin@12345';

const FIXTURE_PDF_NAME = 'e2e-sample-notes.pdf';
const FIXTURE_PDF_PATH = path.join(uploadDirectory, 'materials', FIXTURE_PDF_NAME);
const FIXTURE_PDF_BODY = '%PDF-1.4\n% e2e fixture\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n';

let server: Server;
let baseUrl: string;

/** Ids captured while seeding so individual tests can reference shared fixtures. */
const ids: Record<string, string> = {};

/** Issues a request against the live server and always parses the response. */
async function call(
  method: string,
  routePath: string,
  options: { token?: string; body?: unknown; raw?: boolean } = {}
): Promise<{ status: number; body: any; headers: Headers }> {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body; // let fetch set the multipart boundary
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${baseUrl}${routePath}`, { method, headers, body });
  const text = await response.text();
  if (options.raw) return { status: response.status, body: text, headers: response.headers };
  const contentType = response.headers.get('content-type') ?? '';
  const parsed = contentType.includes('application/json') && text ? JSON.parse(text) : text;
  return { status: response.status, body: parsed, headers: response.headers };
}

const get = (p: string, token?: string) => call('GET', p, { token });
const post = (p: string, body?: unknown, token?: string) => call('POST', p, { body, token });
const patch = (p: string, body?: unknown, token?: string) => call('PATCH', p, { body, token });
const put = (p: string, body?: unknown, token?: string) => call('PUT', p, { body, token });
const del = (p: string, token?: string) => call('DELETE', p, { token });

/** Creates a material row backed by a real file on local disk. */
async function createMaterial(overrides: Record<string, unknown> = {}) {
  const stats = await fs.stat(FIXTURE_PDF_PATH);
  return Material.create({
    title: 'E2E Fixture Material',
    description: 'Material used by the automated end-to-end suite.',
    className: 'Class 10',
    subject: ids.subject,
    board: ids.board,
    chapter: 'Algebra',
    materialType: 'NOTES',
    file: {
      key: `materials/${FIXTURE_PDF_NAME}`,
      originalName: FIXTURE_PDF_NAME,
      mimeType: 'application/pdf',
      size: stats.size
    },
    thumbnail: null,
    uploadedBy: ids.teacher,
    uploadedDate: new Date(),
    visibility: 'PUBLIC',
    accessType: 'PUBLIC_FREE',
    price: 0,
    status: 'PUBLISHED',
    featured: false,
    downloadCount: 0,
    ...overrides
  });
}


before(async () => {
  // The listener comes up first so the seeded credentials can be exchanged for
  // real tokens over HTTP rather than being hand-built.
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  await connectDatabase();
  // Start from a clean slate so a previous failed run cannot influence results.
  await mongoose.connection.db!.dropDatabase();

  await fs.mkdir(path.dirname(FIXTURE_PDF_PATH), { recursive: true });
  await fs.writeFile(FIXTURE_PDF_PATH, FIXTURE_PDF_BODY);

  const subject = await Subject.create({ name: 'Mathematics', slug: 'mathematics', classes: ['Class 10'], active: true, sortOrder: 1 });
  const board = await Board.create({ name: 'CBSE', slug: 'cbse', description: 'Central Board of Secondary Education', active: true, sortOrder: 1 });
  await Settings.create({ instituteName: 'Harshit Education Center', tagline: 'Learn with confidence', phone: '9000000000' });

  const admin = await User.create({ name: 'Harshit Admin', email: 'admin@e2e.test', passwordHash: await hashPassword(ADMIN_PASSWORD), role: 'ADMIN', isActive: true });
  const teacher = await User.create({ name: 'Rajesh Kumar', email: 'teacher@e2e.test', passwordHash: await hashPassword(TEACHER_PASSWORD), role: 'TEACHER', isActive: true });
  const disabled = await User.create({ name: 'Blocked User', email: 'disabled@e2e.test', passwordHash: await hashPassword(ADMIN_PASSWORD), role: 'STUDENT', isActive: false });
  const teacherProfile = await TeacherProfile.create({ user: teacher._id, qualification: 'M.Sc. Mathematics', bio: 'Teaches algebra.', approved: true, canManageAllMaterials: false });

  ids.subject = subject._id.toString();
  ids.board = board._id.toString();
  ids.admin = admin._id.toString();
  ids.teacher = teacher._id.toString();
  ids.disabled = disabled._id.toString();
  ids.teacherProfile = teacherProfile._id.toString();

  // Signed in up front so every suite can authenticate without depending on
  // the order in which the test cases happen to run.
  const teacherLogin = await call('POST', '/api/auth/login', {
    body: { email: 'teacher@e2e.test', password: TEACHER_PASSWORD }
  });
  assert.equal(teacherLogin.status, 200);
  ids.teacherToken = teacherLogin.body.token;

  // The student is registered through the real endpoint so the access-control
  // suites below share a genuine, signed-in account.
  const studentSignup = await call('POST', '/api/auth/register', {
    body: {
      name: 'Aarav Sharma',
      email: 'student@e2e.test',
      password: STUDENT_PASSWORD,
      role: 'STUDENT',
      className: 'Class 10',
      schoolName: 'Delhi Public School',
      guardianName: 'Rakesh Sharma',
      mobile: '9876543210'
    }
  });
  assert.equal(studentSignup.status, 201);
  ids.student = studentSignup.body.user.id;
  ids.studentToken = studentSignup.body.token;

  // Three access tiers plus draft and private listings, used by the download matrix.
  ids.freeMaterial = (await createMaterial({ accessType: 'PUBLIC_FREE' }))._id.toString();
  ids.studentOnlyMaterial = (await createMaterial({ accessType: 'STUDENT_ONLY', title: 'E2E Student Only Notes' }))._id.toString();
  ids.paidMaterial = (await createMaterial({ accessType: 'PAID', price: 299, title: 'E2E Paid Workbook' }))._id.toString();
  ids.draftMaterial = (await createMaterial({ status: 'DRAFT', title: 'E2E Unpublished Draft' }))._id.toString();
  ids.privateMaterial = (await createMaterial({ visibility: 'PRIVATE', title: 'E2E Private Listing' }))._id.toString();
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await mongoose.connection.db!.dropDatabase();
  await fs.rm(FIXTURE_PDF_PATH, { force: true });
  await disconnectDatabase();
});

describe('service health', () => {
  it('reports healthy', async () => {
    const res = await get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.service, 'hec-api');
  });

  it('sets the expected security headers', async () => {
    const res = await get('/api/health');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-powered-by'), null);
  });
});

describe('public catalogue endpoints', () => {
  it('exposes institute settings', async () => {
    const res = await get('/api/public/settings');
    assert.equal(res.status, 200);
    assert.equal(res.body.instituteName, 'Harshit Education Center');
  });

  it('lists class levels', async () => {
    const res = await get('/api/public/classes');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.some((item: any) => item.key === 'Class 10'));
  });

  it('lists active boards, subjects and courses', async () => {
    const boards = await get('/api/public/boards');
    assert.equal(boards.status, 200);
    assert.ok(boards.body.some((item: any) => item.slug === 'cbse'));

    const subjects = await get('/api/public/subjects?className=Class 10');
    assert.equal(subjects.status, 200);
    assert.ok(subjects.body.some((item: any) => item.slug === 'mathematics'));

    const courses = await get('/api/public/courses');
    assert.equal(courses.status, 200);
    assert.ok(Array.isArray(courses.body));
  });

  it('returns 404 for an unknown course slug', async () => {
    const res = await get('/api/public/courses/does-not-exist');
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Course not found');
  });

  it('rejects an invalid class-level filter with a 422', async () => {
    const res = await get('/api/public/materials?className=');
    assert.equal(res.status, 200, 'blank optional filters are ignored');
    const bad = await get('/api/public/materials?page=0');
    assert.equal(bad.status, 422);
    assert.equal(bad.body.error, 'Validation failed');
  });
});

describe('registration and login', () => {
  it('registers a student and returns a session token', async () => {
    const res = await post('/api/auth/register', {
      name: 'Ishita Verma',
      email: 'new-student@e2e.test',
      password: STUDENT_PASSWORD,
      role: 'STUDENT',
      className: 'Class 9',
      schoolName: 'Springdale School',
      guardianName: 'Neha Verma',
      mobile: '9876500011'
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, 'STUDENT');
    assert.equal(res.body.user.email, 'new-student@e2e.test');
    assert.equal(res.body.user.passwordHash, undefined, 'password hash must never be returned');
    assert.ok(res.body.token, 'a JWT is issued on registration');
  });

  it('creates the matching student profile', async () => {
    const profile = await StudentProfile.findOne({ user: ids.student }).lean();
    assert.ok(profile, 'a student profile is created alongside the user');
    assert.equal(profile!.className, 'Class 10');
    assert.equal(profile!.guardianName, 'Rakesh Sharma');
  });

  it('registers a teacher and creates a profile pending approval', async () => {
    const res = await post('/api/auth/register', {
      name: 'Priya Nair',
      email: 'newteacher@e2e.test',
      password: TEACHER_PASSWORD,
      role: 'TEACHER',
      qualification: 'B.Tech Computer Science',
      bio: 'Teaches computer science.'
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, 'TEACHER');

    const profile = await TeacherProfile.findOne({ user: res.body.user.id }).lean();
    assert.ok(profile, 'a teacher profile is created');
    assert.equal(profile!.approved, false);
    ids.pendingTeacherToken = res.body.token;
  });

  it('rejects a duplicate email with 409', async () => {
    const res = await post('/api/auth/register', { name: 'Someone Else', email: 'student@e2e.test', password: STUDENT_PASSWORD });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /already exists/i);
  });

  it('rejects an invalid payload with 422 and field details', async () => {
    const res = await post('/api/auth/register', { name: 'A', email: 'not-an-email', password: 'short' });
    assert.equal(res.status, 422);
    assert.equal(res.body.error, 'Validation failed');
    assert.ok(res.body.details, 'validation details are returned');
  });

  it('logs a valid student in and stamps lastLogin', async () => {
    const res = await post('/api/auth/login', { email: 'student@e2e.test', password: STUDENT_PASSWORD });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);

    const me = await get('/api/auth/me', res.body.token);
    assert.equal(me.status, 200);
    assert.ok(me.body.user.lastLogin, 'lastLogin is recorded on a successful login');
  });
});

describe('session handling and authorisation', () => {
  it('returns the current user and profile', async () => {
    const res = await get('/api/auth/me', ids.studentToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, 'student@e2e.test');
    assert.equal(res.body.profile.className, 'Class 10');
  });

  it('rejects a missing token with 401', async () => {
    const res = await get('/api/auth/me');
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Authentication required');
  });

  it('rejects a malformed token with 401', async () => {
    const res = await get('/api/auth/me', 'not.a.jwt');
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Invalid or expired session');
  });

  it('rejects a token signed with the wrong secret', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const forged = jwt.sign({ sub: ids.admin, role: 'ADMIN' }, 'a-completely-different-secret-value-32', {
      issuer: 'harshit-education-center'
    });
    const res = await get('/api/admin/overview', forged);
    assert.equal(res.status, 401);
  });

  it('updates the student profile', async () => {
    const res = await patch('/api/auth/me', { name: 'Aarav S. Sharma', mobile: '9000000001' }, ids.studentToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.user.name, 'Aarav S. Sharma');
    assert.equal(res.body.profile.mobile, '9000000001');
  });

  it('changes a password and enforces the current one', async () => {
    // A dedicated account is used so rotating the password cannot race against
    // the other suites that still authenticate as the shared student.
    const account = await post('/api/auth/register', {
      name: 'Password Tester',
      email: 'password-tester@e2e.test',
      password: 'FirstPass@12345',
      role: 'STUDENT',
      className: 'Class 8'
    });
    assert.equal(account.status, 201);
    const token = account.body.token;

    const wrong = await post('/api/auth/change-password', { currentPassword: 'WrongPassword@1', newPassword: 'AnotherPass@99' }, token);
    assert.equal(wrong.status, 401);
    assert.match(wrong.body.error, /current password is incorrect/i);

    const tooShort = await post('/api/auth/change-password', { currentPassword: 'FirstPass@12345', newPassword: 'short' }, token);
    assert.equal(tooShort.status, 422);

    const rotated = await post('/api/auth/change-password', { currentPassword: 'FirstPass@12345', newPassword: 'SecondPass@12345' }, token);
    assert.equal(rotated.status, 200);

    const oldLogin = await post('/api/auth/login', { email: 'password-tester@e2e.test', password: 'FirstPass@12345' });
    assert.equal(oldLogin.status, 401, 'the previous password no longer works');

    const newLogin = await post('/api/auth/login', { email: 'password-tester@e2e.test', password: 'SecondPass@12345' });
    assert.equal(newLogin.status, 200, 'the new password works');
  });

  it('blocks a student from admin endpoints with 403', async () => {
    const res = await get('/api/admin/overview', ids.studentToken);
    assert.equal(res.status, 403);
    assert.match(res.body.error, /permission/i);
  });

  it('blocks anonymous access to admin endpoints with 401', async () => {
    const res = await get('/api/admin/overview');
    assert.equal(res.status, 401);
  });

  it('blocks a student from teacher-only dashboard endpoints', async () => {
    const res = await get('/api/dashboard/materials', ids.studentToken);
    assert.equal(res.status, 403);
  });
});

describe('material visibility rules', () => {
  it('hides drafts and private listings from the public list', async () => {
    const res = await get('/api/public/materials');
    assert.equal(res.status, 200);
    const titles = res.body.items.map((item: any) => item.title);
    assert.ok(titles.includes('E2E Fixture Material'));
    assert.ok(!titles.includes('E2E Unpublished Draft'), 'drafts are not published');
    assert.ok(!titles.includes('E2E Private Listing'), 'private listings are not published');
  });

  it('returns 404 for a draft material detail request', async () => {
    const res = await get(`/api/public/materials/${ids.draftMaterial}`);
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Material not found');
  });

  it('lets the owning teacher see their own draft', async () => {
    const res = await get(`/api/public/materials/${ids.draftMaterial}`, ids.teacherToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'DRAFT');
  });

  it('flags access state per material for anonymous visitors', async () => {
    const res = await get('/api/public/materials');
    const byTitle = Object.fromEntries(res.body.items.map((item: any) => [item.title, item]));

    assert.equal(byTitle['E2E Fixture Material'].hasAccess, true);
    assert.equal(byTitle['E2E Student Only Notes'].hasAccess, false);
    assert.equal(byTitle['E2E Student Only Notes'].accessReason, 'login');
    assert.equal(byTitle['E2E Paid Workbook'].hasAccess, false);
    assert.equal(byTitle['E2E Paid Workbook'].accessReason, 'login');
  });

  it('flags student-only access as granted once signed in', async () => {
    const res = await get('/api/public/materials', ids.studentToken);
    const item = res.body.items.find((entry: any) => entry.title === 'E2E Student Only Notes');
    assert.equal(item.hasAccess, true);
  });

  it('supports search and class filters', async () => {
    const res = await get('/api/public/materials?search=Workbook');
    assert.equal(res.status, 200);
    assert.equal(res.body.items.length, 1);
    assert.equal(res.body.items[0].title, 'E2E Paid Workbook');

    const empty = await get('/api/public/materials?className=Class%2099');
    assert.equal(empty.status, 200);
    assert.equal(empty.body.total, 0);
  });

  it('validates a malformed ObjectId filter with 422', async () => {
    const res = await get('/api/public/materials?subject=not-an-id');
    assert.equal(res.status, 422);
  });
});

describe('download access matrix', () => {
  /**
   * The React client shows a "sign in" prompt instead of a download button for
   * signed-out visitors (`MaterialCard` and `MaterialDetail` both return early
   * when there is no session), so the API deliberately keeps `requireAuth` on the
   * download route even for free material.
   */
  it('requires a session even for public free material', async () => {
    const res = await get(`/api/materials/${ids.freeMaterial}/download`);
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Authentication required');
  });

  it('serves a public free material to a signed-in student', async () => {
    const res = await call('GET', `/api/materials/${ids.freeMaterial}/download`, { token: ids.studentToken, raw: true });
    assert.equal(res.status, 200);
    assert.match(String(res.body), /^%PDF-1\.4/);
    assert.match(res.headers.get('content-disposition') ?? '', /attachment; filename=/);
    assert.match(res.headers.get('content-type') ?? '', /application\/pdf/);
  });

  it('requires a session for student-only material', async () => {
    const res = await get(`/api/materials/${ids.studentOnlyMaterial}/download`);
    assert.equal(res.status, 401);
  });

  it('allows a signed-in student to fetch student-only material', async () => {
    const res = await call('GET', `/api/materials/${ids.studentOnlyMaterial}/download`, { token: ids.studentToken, raw: true });
    assert.equal(res.status, 200);
    assert.match(String(res.body), /^%PDF-1\.4/);
  });

  it('returns 402 for paid material the student does not own', async () => {
    const res = await get(`/api/materials/${ids.paidMaterial}/download`, ids.studentToken);
    assert.equal(res.status, 402);
    assert.match(res.body.error, /purchase/i);
  });

  it('unlocks paid material after a successful purchase', async () => {
    const bought = await post(`/api/materials/${ids.paidMaterial}/purchase`, undefined, ids.studentToken);
    assert.equal(bought.status, 201);
    assert.equal(bought.body.purchase.paymentStatus, 'PAID');
    assert.ok(bought.body.purchase.transactionId);

    const res = await call('GET', `/api/materials/${ids.paidMaterial}/download`, { token: ids.studentToken, raw: true });
    assert.equal(res.status, 200);
    assert.match(String(res.body), /^%PDF-1\.4/);
  });

  it('treats a repeat purchase as idempotent', async () => {
    const res = await post(`/api/materials/${ids.paidMaterial}/purchase`, undefined, ids.studentToken);
    assert.equal(res.status, 200);
    assert.match(res.body.message, /already own/i);
  });

  it('refuses to "purchase" material that is free', async () => {
    const res = await post(`/api/materials/${ids.freeMaterial}/purchase`, undefined, ids.studentToken);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /does not require a payment/i);
  });

  it('refuses access to an unpublished material even for a signed-in student', async () => {
    const res = await get(`/api/materials/${ids.draftMaterial}/download`, ids.studentToken);
    assert.equal(res.status, 402);
    assert.match(res.body.error, /not available/i);
  });

  it('increments the download counter and records history', async () => {
    const before = await Material.findById(ids.freeMaterial).lean();
    await call('GET', `/api/materials/${ids.freeMaterial}/download`, { token: ids.studentToken, raw: true });
    const after = await Material.findById(ids.freeMaterial).lean();
    assert.equal(after!.downloadCount, before!.downloadCount + 1);

    const history = await get('/api/materials/me/downloads', ids.studentToken);
    assert.equal(history.status, 200);
    assert.ok(history.body.length > 0);
    assert.ok(history.body.some((row: any) => row.material));
  });

  it('returns 404 for an unknown material id', async () => {
    const res = await get('/api/materials/64b7f1c2a1b2c3d4e5f60718/download', ids.studentToken);
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Material not found');
  });

  it('protects the raw file endpoint behind authentication', async () => {
    const anonymous = await get(`/api/files/materials/${FIXTURE_PDF_NAME}`);
    assert.equal(anonymous.status, 401);

    const authorised = await get(`/api/files/materials/${FIXTURE_PDF_NAME}`, ids.studentToken);
    assert.equal(authorised.status, 200);
  });
});

describe('student favourites and dashboard', () => {
  it('adds and removes a favourite material', async () => {
    const added = await post(`/api/materials/${ids.freeMaterial}/favourite`, undefined, ids.studentToken);
    assert.equal(added.status, 200);
    assert.equal(added.body.favourited, true);

    const list = await get('/api/materials/me/favourites', ids.studentToken);
    assert.equal(list.status, 200);
    assert.ok(list.body.some((item: any) => item.id === ids.freeMaterial));

    const removed = await del(`/api/materials/${ids.freeMaterial}/favourite`, ids.studentToken);
    assert.equal(removed.status, 200);
    assert.equal(removed.body.favourited, false);

    const afterRemoval = await get('/api/materials/me/favourites', ids.studentToken);
    assert.ok(!afterRemoval.body.some((item: any) => item.id === ids.freeMaterial));
  });

  it('does not duplicate a favourite on repeated calls', async () => {
    await post(`/api/materials/${ids.freeMaterial}/favourite`, undefined, ids.studentToken);
    await post(`/api/materials/${ids.freeMaterial}/favourite`, undefined, ids.studentToken);

    const profile = await StudentProfile.findOne({ user: ids.student }).lean();
    const matches = (profile!.favouriteMaterials as any[]).filter((entry) => entry.toString() === ids.freeMaterial);
    assert.equal(matches.length, 1);
    await del(`/api/materials/${ids.freeMaterial}/favourite`, ids.studentToken);
  });

  it('requires authentication for favourites', async () => {
    const res = await post(`/api/materials/${ids.freeMaterial}/favourite`);
    assert.equal(res.status, 401);
  });

  it('returns a student summary with stats', async () => {
    const res = await get('/api/dashboard/summary', ids.studentToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.role, 'STUDENT');
    assert.ok(res.body.stats.downloads > 0);
    assert.equal(res.body.stats.purchases, 1);
    assert.ok(Array.isArray(res.body.recentDownloads));
  });

  it('lists the student purchases', async () => {
    const res = await get('/api/materials/me/purchases', ids.studentToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].material.id, ids.paidMaterial);
    assert.equal(res.body[0].paymentStatus, 'PAID');
  });
});

describe('teacher workspace', () => {
  /** Builds the multipart body the upload endpoints expect. */
  function materialForm(fields: Record<string, string>, filename = FIXTURE_PDF_NAME) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    form.append('file', new Blob([FIXTURE_PDF_BODY], { type: 'application/pdf' }), filename);
    return form;
  }

  it('runs the full upload, update and delete lifecycle', async () => {
    const token = ids.teacherToken;
    const created = await call('POST', '/api/dashboard/materials', {
      token,
      body: materialForm({
        title: 'E2E Uploaded Notes',
        description: 'Uploaded through the teacher dashboard endpoint.',
        className: 'Class 10',
        subject: ids.subject,
        board: ids.board,
        chapter: 'Polynomials',
        materialType: 'NOTES',
        visibility: 'PUBLIC',
        accessType: 'PUBLIC_FREE',
        status: 'PUBLISHED',
        featured: 'true'
      })
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.title, 'E2E Uploaded Notes');
    assert.ok(created.body.fileName, 'the stored file metadata is returned');
    assert.equal(created.body.featured, true);

    // `fileName` is the original upload name; the storage key is generated by the
    // upload middleware, so read the persisted document for the real key.
    const stored = await Material.findById(created.body.id).lean();
    const fileKey = stored!.file.key;
    const onDisk = await fs.stat(path.join(uploadDirectory, fileKey));
    assert.ok(onDisk.size > 0, 'the uploaded file is written to local storage');

    const updated = await patch(`/api/dashboard/materials/${created.body.id}`, { title: 'E2E Uploaded Notes (v2)', status: 'DRAFT' }, token);
    assert.equal(updated.status, 200);
    assert.equal(updated.body.title, 'E2E Uploaded Notes (v2)');
    assert.equal(updated.body.status, 'DRAFT');

    const blocked = await patch(`/api/dashboard/materials/${created.body.id}`, { title: 'Hijacked' }, ids.pendingTeacherToken);
    assert.equal(blocked.status, 403, 'a different teacher cannot edit it');
    assert.match(blocked.body.error, /only manage materials you uploaded/i);

    const removed = await del(`/api/dashboard/materials/${created.body.id}`, token);
    assert.equal(removed.status, 200);
    assert.equal(await Material.findById(created.body.id), null, 'the material row is gone');

    const leftover = await fs.stat(path.join(uploadDirectory, fileKey)).catch(() => null);
    assert.equal(leftover, null, 'the stored file is removed too');
  });

  it('replaces the stored file and drops the superseded one', async () => {
    const token = ids.teacherToken;
    const created = await call('POST', '/api/dashboard/materials', {
      token,
      body: materialForm({
        title: 'E2E Replacement Source',
        description: 'Original upload that is about to be replaced by a new file.',
        className: 'Class 10',
        subject: ids.subject,
        board: ids.board,
        materialType: 'NOTES',
        visibility: 'PUBLIC',
        accessType: 'PUBLIC_FREE'
      })
    });
    assert.equal(created.status, 201);

    const original = (await Material.findById(created.body.id).lean())!;
    const originalKey = original.file.key;
    assert.ok(await fs.stat(path.join(uploadDirectory, originalKey)), 'the original file is stored');

    // Swap in a differently named file so the new key is unambiguous.
    const replacementForm = new FormData();
    replacementForm.append('title', 'E2E Replacement Target');
    replacementForm.append('file', new Blob([FIXTURE_PDF_BODY], { type: 'application/pdf' }), 'e2e-replacement-notes.pdf');
    const replaced = await call('PATCH', `/api/dashboard/materials/${created.body.id}`, { token, body: replacementForm });
    assert.equal(replaced.status, 200);

    const updated = (await Material.findById(created.body.id).lean())!;
    assert.notEqual(updated.file.key, originalKey, 'the row points at the replacement file');
    assert.equal(updated.file.originalName, 'e2e-replacement-notes.pdf');
    assert.ok(await fs.stat(path.join(uploadDirectory, updated.file.key)), 'the replacement file is written to storage');
    assert.equal(
      await fs.stat(path.join(uploadDirectory, originalKey)).catch(() => null),
      null,
      'the superseded file is removed only after the row no longer refers to it'
    );

    await del(`/api/dashboard/materials/${created.body.id}`, token);
  });

  it('requires a file to be attached', async () => {
    const form = new FormData();
    form.append('title', 'No File Material');
    form.append('description', 'This submission has no file attached at all.');
    form.append('className', 'Class 10');
    form.append('subject', ids.subject);
    form.append('materialType', 'NOTES');
    form.append('visibility', 'PUBLIC');
    form.append('accessType', 'PUBLIC_FREE');

    const res = await call('POST', '/api/dashboard/materials', { token: ids.teacherToken, body: form });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /attach a file/i);
  });

  it('rejects an unsupported file type', async () => {
    const form = materialForm({
      title: 'Bad Type',
      description: 'This attachment is not an allowed document type.',
      className: 'Class 10',
      subject: ids.subject,
      materialType: 'NOTES',
      visibility: 'PUBLIC',
      accessType: 'PUBLIC_FREE'
    });
    form.set('file', new Blob(['MZ binary junk'], { type: 'application/x-msdownload' }), 'malicious.exe');

    const res = await call('POST', '/api/dashboard/materials', { token: ids.teacherToken, body: form });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /unsupported file type/i);
  });

  it('validates the upload payload with 422', async () => {
    const form = materialForm({ title: 'No', description: 'x', className: '', materialType: 'BOGUS' });
    const res = await call('POST', '/api/dashboard/materials', { token: ids.teacherToken, body: form });
    assert.equal(res.status, 422);
  });

  it('discards the uploaded file when the request is rejected', async () => {
    // Multer writes the file to disk before the payload is validated, so a
    // rejected upload must still be cleaned up instead of leaking on disk.
    const before = await fs.readdir(uploadDirectory);
    const form = materialForm({ title: 'No', description: 'x', className: '', materialType: 'BOGUS' });
    const res = await call('POST', '/api/dashboard/materials', { token: ids.teacherToken, body: form });
    assert.equal(res.status, 422);
    assert.deepEqual(await fs.readdir(uploadDirectory), before, 'no temporary file is left behind');
  });

  it('keeps the upload directory free of stray files for the whole suite', async () => {
    // Everything still present should belong to a sub-folder managed by the
    // storage adapter; the loose files multer creates never survive a request.
    const stray = (await fs.readdir(uploadDirectory)).filter((entry) => entry.includes('e2e-sample-notes'));
    assert.deepEqual(stray, [], 'rejected and superseded uploads do not accumulate');
  });

  it('rejects an upload from a student', async () => {
    const form = materialForm({
      title: 'Student Upload',
      description: 'Students must not be able to upload material.',
      className: 'Class 10',
      subject: ids.subject,
      materialType: 'NOTES',
      visibility: 'PUBLIC',
      accessType: 'PUBLIC_FREE'
    });
    const res = await call('POST', '/api/dashboard/materials', { token: ids.studentToken, body: form });
    assert.equal(res.status, 403);
  });

  it('scopes the teacher material list to their own uploads', async () => {
    const res = await get('/api/dashboard/materials', ids.teacherToken);
    assert.equal(res.status, 200);
    assert.ok(res.body.total >= 1);
  });

  it('returns a teacher summary scoped to their uploads', async () => {
    const res = await get('/api/dashboard/summary', ids.teacherToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.role, 'TEACHER');
    assert.ok(typeof res.body.stats.total === 'number');
  });
});

describe('admin workspace', () => {
  async function adminLogin() {
    const res = await post('/api/auth/login', { email: 'admin@e2e.test', password: ADMIN_PASSWORD });
    assert.equal(res.status, 200);
    return res.body.token as string;
  }

  it('returns the platform overview', async () => {
    const token = await adminLogin();
    ids.adminToken = token;
    const res = await get('/api/admin/overview', token);
    assert.equal(res.status, 200);
    assert.ok(res.body.users >= 3);
    assert.ok(res.body.materials >= 1);
  });

  it('lists users without exposing password hashes', async () => {
    const res = await get('/api/admin/users', ids.adminToken);
    assert.equal(res.status, 200);
    assert.ok(res.body.length >= 3);
    assert.ok(res.body.every((user: any) => user.passwordHash === undefined));
  });

  it('filters users by role', async () => {
    const res = await get('/api/admin/users?role=TEACHER', ids.adminToken);
    assert.equal(res.status, 200);
    assert.ok(res.body.every((user: any) => user.role === 'TEACHER'));
  });

  it('approves a pending teacher', async () => {
    const pending = await TeacherProfile.findOne({ approved: false }).lean();
    assert.ok(pending, 'the newly registered teacher is pending');

    const res = await patch(`/api/admin/teachers/${pending!._id.toString()}`, { approved: true }, ids.adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.approved, true);
  });

  it('revokes and re-grants a teacher approval', async () => {
    // The React admin sends real JSON booleans, which is what the schema expects.
    const revoked = await patch(`/api/admin/teachers/${ids.teacherProfile}`, { approved: false }, ids.adminToken);
    assert.equal(revoked.status, 200);
    assert.equal(revoked.body.approved, false);

    const restored = await patch(`/api/admin/teachers/${ids.teacherProfile}`, { approved: true }, ids.adminToken);
    assert.equal(restored.status, 200);
    assert.equal(restored.body.approved, true);
  });

  it('stops an admin from demoting themselves', async () => {
    const res = await patch(`/api/admin/users/${ids.admin}`, { role: 'STUDENT' }, ids.adminToken);
    assert.equal(res.status, 400);
  });

  it('creates and removes a notice', async () => {
    const created = await post('/api/admin/notices', {
      title: 'E2E Notice',
      body: 'Automated test notice body.',
      category: 'GENERAL',
      published: 'true'
    }, ids.adminToken);
    assert.equal(created.status, 201);

    const published = await get('/api/public/notices');
    assert.ok(published.body.some((notice: any) => notice.title === 'E2E Notice'));

    const removed = await del(`/api/admin/notices/${created.body._id}`, ids.adminToken);
    assert.equal(removed.status, 200);
  });

  it('updates institute settings', async () => {
    const res = await put('/api/admin/settings', { tagline: 'Quality coaching since 2009', phone: '9111111111' }, ids.adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.tagline, 'Quality coaching since 2009');

    const publicView = await get('/api/public/settings');
    assert.equal(publicView.body.tagline, 'Quality coaching since 2009');
  });

  it('lists all materials including unpublished ones', async () => {
    const res = await get('/api/admin/materials', ids.adminToken);
    assert.equal(res.status, 200);
    assert.ok(res.body.items.length >= 1);
    assert.ok(res.body.total >= 1);
    // Unlike the public listing, the admin view includes unpublished material.
    assert.ok(res.body.items.some((item: any) => item.status === 'DRAFT' || item.status === 'PUBLISHED'));
  });

  it('filters the admin material list by status', async () => {
    const drafts = await get('/api/admin/materials?status=DRAFT', ids.adminToken);
    assert.equal(drafts.status, 200);
    assert.ok(drafts.body.items.every((item: any) => item.status === 'DRAFT'));
  });
});

describe('enquiries', () => {
  it('accepts a public enquiry', async () => {
    const res = await post('/api/public/enquiries', {
      name: 'Meena Kumari',
      mobile: '9123456780',
      email: 'meena@example.com',
      className: 'Class 9',
      board: ids.board,
      message: 'Please share the science batch timings.'
    });
    assert.equal(res.status, 201);
    ids.enquiry = res.body._id ?? res.body.id;
  });

  it('rejects an enquiry with a short message', async () => {
    const res = await post('/api/public/enquiries', { name: 'X Y', mobile: '9123456780', className: 'Class 9', message: 'hi' });
    assert.equal(res.status, 422);
  });

  it('tracks the enquiry status through the admin API', async () => {
    const list = await get('/api/admin/enquiries', ids.adminToken);
    assert.equal(list.status, 200);
    assert.ok(list.body.length >= 1);

    const updated = await patch(`/api/admin/enquiries/${ids.enquiry}`, { status: 'CONTACTED' }, ids.adminToken);
    assert.equal(updated.status, 200);
    assert.equal(updated.body.status, 'CONTACTED');

    const bad = await patch(`/api/admin/enquiries/${ids.enquiry}`, { status: 'NONSENSE' }, ids.adminToken);
    assert.equal(bad.status, 422);

    const removed = await del(`/api/admin/enquiries/${ids.enquiry}`, ids.adminToken);
    assert.equal(removed.status, 200);
  });
});

describe('error handling and SPA fallback', () => {
  it('returns a JSON 404 for an unknown API route', async () => {
    const res = await get('/api/this-route-does-not-exist');
    assert.equal(res.status, 404);
    assert.equal(res.headers.get('content-type')?.includes('application/json'), true);
    assert.match(res.body.error, /not found/i);
  });

  it('returns a JSON 404 for an unknown API sub-resource', async () => {
    const res = await get('/api/public/no-such-endpoint');
    assert.equal(res.status, 404);
    assert.match(res.body.error, /not found/i);
  });

  it('never leaks a stack trace in an error response', async () => {
    const res = await get('/api/public/materials/not-a-valid-object-id');
    // A malformed id is a client error, so it must not be reported as a 500.
    assert.equal(res.status, 400);
    assert.equal(String(res.body.error).includes('at '), false);
  });

  it('serves the built client as an SPA fallback for unknown routes', async (t) => {
    const built = await fs.stat(clientIndexFile).then(() => true).catch(() => false);
    if (!built) {
      t.skip('client/dist/index.html is not built yet (run npm run build --workspace client)');
      return;
    }
    const res = await call('GET', '/some/deep/client/route', { raw: true });
    assert.equal(res.status, 200);
    assert.match(String(res.body), /<div id="root">/);
  });

  it('serves real built assets instead of the HTML shell', async (t) => {
    const built = await fs.stat(clientIndexFile).then(() => true).catch(() => false);
    if (!built) {
      t.skip('client/dist is not built yet (run npm run build --workspace client)');
      return;
    }
    // Regression guard: with no static handler the SPA fallback answers asset
    // requests with index.html, and the browser gets HTML where it expects
    // JavaScript, leaving the production app blank.
    const assets = await fs.readdir(path.join(clientDistDirectory, 'assets'));
    const bundle = assets.find((entry) => entry.endsWith('.js'));
    assert.ok(bundle, 'the build produced a JavaScript bundle');

    const res = await call('GET', `/assets/${bundle}`, { raw: true });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /javascript/, 'the bundle is served as JavaScript');
    assert.doesNotMatch(String(res.body), /<div id="root">/, 'the HTML shell is not returned for an asset');
    assert.match(res.headers.get('cache-control') ?? '', /immutable/, 'hashed assets are cached indefinitely');
  });

  it('marks the HTML entry point as revalidatable', async (t) => {
    const built = await fs.stat(clientIndexFile).then(() => true).catch(() => false);
    if (!built) {
      t.skip('client/dist/index.html is not built yet (run npm run build --workspace client)');
      return;
    }
    const res = await call('GET', '/', { raw: true });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('cache-control') ?? '', /no-cache/, 'a deploy is picked up immediately');
  });
});
