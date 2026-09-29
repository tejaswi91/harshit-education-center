import fs from 'node:fs/promises';
import path from 'node:path';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { User, hashPassword } from './models/User.js';
import { StudentProfile } from './models/StudentProfile.js';
import { TeacherProfile } from './models/TeacherProfile.js';
import { Board } from './models/Board.js';
import { Subject } from './models/Subject.js';
import { Course } from './models/Course.js';
import { Material } from './models/Material.js';
import { Notice } from './models/Notice.js';
import { Testimonial } from './models/Testimonial.js';
import { GalleryItem } from './models/GalleryItem.js';
import { Enquiry } from './models/Enquiry.js';
import { Settings } from './models/Settings.js';
import { uploadDirectory } from './middleware/upload.js';
import { storage } from './services/storage.js';
import { CLASS_LEVELS, DEFAULT_BOARDS, DEFAULT_SUBJECTS } from './services/access.js';

/**
 * Builds a small but structurally valid single-page PDF so seeded materials
 * can actually be opened and downloaded during local development.
 */
function buildSamplePdf(title: string, lines: string[]) {
  const content = [
    'BT',
    '/F1 20 Tf',
    '60 740 Td',
    `(${title.replace(/[()\\]/g, '')}) Tj`,
    '/F1 12 Tf',
    '0 -40 Td',
    ...lines.flatMap((line) => [`(${line.replace(/[()\\]/g, '')}) Tj`, '0 -18 Td']),
    'ET'
  ].join('\n');

  const objects = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>',
    `<</Length ${Buffer.byteLength(content, 'latin1')}>>\nstream\n${content}\nendstream`,
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>'
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}

async function writeSeedMaterial(title: string, body: string[]) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e6)}-${slug}.pdf`;
  const contents = buildSamplePdf(title, body);

  /**
   * Written through the storage adapter rather than straight to disk, so seeded
   * material lands in the same place the configured provider serves downloads
   * from. Writing to local disk directly would create rows whose files are
   * unreachable the moment the host is not a long-lived one with a persistent
   * volume, which is exactly the case a serverless deployment runs in.
   */
  const folder = path.join(uploadDirectory, 'materials');
  await fs.mkdir(folder, { recursive: true });
  const scratch = path.join(folder, filename);
  await fs.writeFile(scratch, contents);

  try {
    return await storage.put({
      fieldname: 'file',
      originalname: filename,
      mimetype: 'application/pdf',
      size: contents.byteLength,
      destination: folder,
      filename,
      path: scratch,
      buffer: contents
    } as Express.Multer.File, 'materials');
  } catch (error) {
    await fs.unlink(scratch).catch(() => undefined);
    throw error;
  }
}
async function seed() {
  await connectDatabase();

  console.log('Clearing existing data...');
  await Promise.all([
    User.deleteMany({}), StudentProfile.deleteMany({}), TeacherProfile.deleteMany({}),
    Board.deleteMany({}), Subject.deleteMany({}), Course.deleteMany({}),
    Material.deleteMany({}), Notice.deleteMany({}), Testimonial.deleteMany({}),
    GalleryItem.deleteMany({}), Enquiry.deleteMany({}), Settings.deleteMany({})
  ]);

  console.log('Creating boards and subjects...');
  const boards = await Board.insertMany(
    DEFAULT_BOARDS.map((board, index) => ({ ...board, active: true, sortOrder: index + 1 }))
  );
  const subjects = await Subject.insertMany(
    DEFAULT_SUBJECTS.map((subject, index) => ({
      ...subject,
      classes: CLASS_LEVELS.map((level) => level.key),
      active: true,
      sortOrder: index + 1
    }))
  );

  console.log('Creating users...');
  const [admin, teacher, student] = await User.create([
    { name: 'Harshit Admin', email: 'admin@harshiteducationcenter.in', passwordHash: await hashPassword('Admin@12345'), role: 'ADMIN', isActive: true },
    { name: 'Rajesh Kumar', email: 'teacher@harshiteducationcenter.in', passwordHash: await hashPassword('Teacher@12345'), role: 'TEACHER', isActive: true },
    { name: 'Aarav Sharma', email: 'student@harshiteducationcenter.in', passwordHash: await hashPassword('Student@12345'), role: 'STUDENT', isActive: true }
  ]);

  await TeacherProfile.create({
    user: teacher._id,
    qualification: 'M.Sc, B.Ed',
    bio: 'Senior mathematics faculty with 12 years of experience in board and competitive exam preparation.',
    subjects: [subjects[2]._id],
    classes: ['Class 9', 'Class 10', 'Class 11', 'Class 12'],
    experienceYears: 12,
    approved: true,
    canManageAllMaterials: true
  });
  await StudentProfile.create({
    user: student._id,
    className: 'Class 10',
    board: boards[0]._id,
    schoolName: 'Delhi Public School',
    guardianName: 'Rakesh Sharma',
    mobile: '+91 90000 00000'
  });
  console.log('Creating courses...');
  const groupLabels: Record<string, string> = {
    'LKG - UKG': 'Nursery, LKG and UKG',
    'Class 1 - 5': 'Primary Classes (Class 1 - 5)',
    'Class 6 - 8': 'Middle School (Class 6 - 8)',
    'Class 9 - 10': 'Secondary School (Class 9 - 10)',
    'Class 11 - 12': 'Senior Secondary (Class 11 - 12)'
  };
  const seenGroups = new Set<string>();
  const courseDocs = CLASS_LEVELS
    .filter((level) => (seenGroups.has(level.group) ? false : (seenGroups.add(level.group), true)))
    .map((level, index) => ({
      title: `${groupLabels[level.group]} Course`,
      slug: groupLabels[level.group].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      className: level.group,
      description: `Complete coaching programme for ${groupLabels[level.group].toLowerCase()} covering all major boards with concept classes, practice sheets and doubt sessions.`,
      subjects: subjects.map((subject) => subject._id),
      boards: boards.map((board) => board._id),
      active: true,
      sortOrder: index + 1
    }));
  await Course.insertMany(courseDocs);

  console.log('Creating sample materials...');
  const materialSeeds = [
    { title: 'Class 10 Science Notes - Light', className: 'Class 10', subject: 3, type: 'NOTES', access: 'PUBLIC_FREE', price: 0, chapter: 'Light' },
    { title: 'Class 10 Maths Worksheet - Polynomials', className: 'Class 10', subject: 2, type: 'WORKSHEET', access: 'STUDENT_ONLY', price: 0, chapter: 'Polynomials' },
    { title: 'Class 12 Physics Previous Year Paper', className: 'Class 12', subject: 3, type: 'PREVIOUS_YEAR_PAPER', access: 'PAID', price: 149, chapter: 'Electricity' },
    { title: 'Class 9 Science Sample Paper', className: 'Class 9', subject: 3, type: 'SAMPLE_PAPER', access: 'PUBLIC_FREE', price: 0, chapter: 'Full Syllabus' },
    { title: 'Class 8 Maths Revision Material', className: 'Class 8', subject: 2, type: 'REVISION_MATERIAL', access: 'STUDENT_ONLY', price: 0, chapter: 'Algebra' },
    { title: 'Class 10 English Question Paper', className: 'Class 10', subject: 0, type: 'QUESTION_PAPER', access: 'PAID', price: 99, chapter: 'First Flight' }
  ];
  for (const item of materialSeeds) {
    const file = await writeSeedMaterial(item.title, [
      `Class: ${item.className}`,
      `Subject reference: ${subjects[item.subject].name}`,
      'This is sample seed content for local development.',
      'Replace it with real study material from the teacher dashboard.'
    ]);
    await Material.create({
      title: item.title,
      description: `${item.title} - curated by our faculty for focused practice and complete concept clarity.`,
      className: item.className,
      subject: subjects[item.subject]._id,
      board: boards[0]._id,
      chapter: item.chapter,
      materialType: item.type,
      file,
      thumbnail: null,
      uploadedBy: teacher._id,
      uploadedDate: new Date(),
      visibility: 'PUBLIC',
      accessType: item.access,
      price: item.price,
      status: 'PUBLISHED',
      featured: item.price > 0,
      downloadCount: 0
    });
  }

  console.log('Creating notices, testimonials and gallery...');
  await Notice.insertMany([
    { title: 'Half Yearly Exam Schedule Released', body: 'The half yearly examination schedule for Classes 6 to 12 has been released. Students can download the full timetable from the study material section.', category: 'EXAM', published: true, publishDate: new Date(Date.now() - 2 * 86400000), createdBy: admin._id },
    { title: 'New Study Material Uploaded', body: 'Notes and practice sheets for the new session are now available. Browse the study material section to find chapter-wise resources.', category: 'MATERIAL', published: true, publishDate: new Date(Date.now() - 5 * 86400000), createdBy: admin._id },
    { title: 'Admissions Open for 2026-27', body: 'Admissions are now open for the new academic session. Enquire today to secure a seat in your preferred batch.', category: 'ADMISSION', published: true, publishDate: new Date(Date.now() - 10 * 86400000), createdBy: admin._id }
  ]);

  await Testimonial.insertMany([
    { name: 'Ananya Sharma', quote: 'Harshit Education Center has helped me improve my confidence and understanding in subjects. The teachers are very supportive!', className: 'Class 10 (CBSE)', published: true, sortOrder: 1 },
    { name: 'Rohit Verma', quote: 'The chapter-wise notes and practice sheets made revision much easier before my board exams.', className: 'Class 12 (CBSE)', published: true, sortOrder: 2 },
    { name: 'Priya Singh', quote: 'Doubt sessions here are excellent. Every teacher takes time to explain concepts until you truly understand.', className: 'Class 8 (ICSE)', published: true, sortOrder: 3 }
  ]);

  await GalleryItem.insertMany([
    { title: 'Classroom', imageUrl: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1200&q=80', altText: 'Bright classroom with desks', category: 'Campus', published: true, sortOrder: 1 },
    { title: 'Science Lab', imageUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=1200&q=80', altText: 'Students in a science laboratory', category: 'Campus', published: true, sortOrder: 2 },
    { title: 'Library', imageUrl: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200&q=80', altText: 'Institute library shelves', category: 'Campus', published: true, sortOrder: 3 }
  ]);

  await Enquiry.create({
    name: 'Sunita Yadav',
    mobile: '+91 91234 56789',
    email: 'sunita@example.com',
    className: 'Class 9',
    board: boards[0]._id,
    message: 'I would like to know the fee structure and batch timings for Class 9.',
    status: 'NEW'
  });

  await Settings.create({
    instituteName: 'Harshit Education Center',
    tagline: 'Learn Today • Lead Tomorrow',
    phone: '+91 98765 43210',
    email: 'info@harshiteducationcenter.in',
    address: 'Gorakhpur, Uttar Pradesh',
    socialLinks: { youtube: '', instagram: '', facebook: '', linkedin: '' },
    admissionMessage: 'Admissions are open. Enquire today to begin your learning journey.',
    updatedBy: admin._id
  });

}

seed()
  .then(async () => {
    console.log('\nSeed complete. Demo logins:');
    console.log('  Admin   admin@harshiteducationcenter.in   / Admin@12345');
    console.log('  Teacher teacher@harshiteducationcenter.in / Teacher@12345');
    console.log('  Student student@harshiteducationcenter.in / Student@12345');
    await disconnectDatabase();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Seed failed', error);
    await disconnectDatabase().catch(() => undefined);
    process.exit(1);
  });


