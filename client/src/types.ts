export type Role = 'STUDENT' | 'TEACHER' | 'ADMIN';
export type MaterialType = 'NOTES' | 'WORKSHEET' | 'QUESTION_PAPER' | 'SAMPLE_PAPER' | 'PREVIOUS_YEAR_PAPER' | 'ASSIGNMENT' | 'REVISION_MATERIAL' | 'PRACTICE_SHEET' | 'OTHER';
export type AccessType = 'PUBLIC_FREE' | 'STUDENT_ONLY' | 'PAID';
export type MaterialStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface ClassLevel {
  key: string;
  label: string;
  group: string;
  tone: string;
}

export interface BoardRef { _id: string; name: string; slug: string; description?: string }
export interface SubjectRef { _id: string; name: string; slug: string; classes?: string[] }

export interface Material {
  id: string;
  title: string;
  description: string;
  className: string;
  subject: SubjectRef | string | null;
  board: BoardRef | string | null;
  chapter: string;
  materialType: MaterialType;
  accessType: AccessType;
  price: number;
  status: MaterialStatus;
  featured: boolean;
  downloadCount: number;
  uploadedDate: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  thumbnail: string | null;
  hasAccess?: boolean;
  accessReason?: 'login' | 'purchase' | 'expired' | 'unavailable' | string;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages?: number;
}

export interface NoticeItem {
  _id: string;
  title: string;
  body: string;
  category: 'ADMISSION' | 'EXAM' | 'MATERIAL' | 'GENERAL';
  published: boolean;
  publishDate: string;
}

export interface TestimonialItem {
  _id: string;
  name: string;
  quote: string;
  className: string;
  photoUrl?: string;
}

export interface GalleryItemType {
  _id: string;
  title: string;
  imageUrl: string;
  altText: string;
  category?: string;
}

export interface TeacherItem {
  id: string;
  name: string;
  email: string;
  qualification?: string;
  bio?: string;
  photoUrl?: string;
  subjects: SubjectRef[];
  classes: string[];
  experienceYears: number;
}

export interface CourseItem {
  _id: string;
  title: string;
  slug: string;
  className: string;
  description: string;
  subjects: SubjectRef[];
  boards: BoardRef[];
}

export interface InstituteSettings {
  instituteName: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  socialLinks: { youtube?: string; instagram?: string; facebook?: string; linkedin?: string };
  logoUrl?: string;
  heroImageUrl?: string;
  admissionMessage: string;
}

export interface MaterialFilters {
  className?: string;
  subject?: string;
  board?: string;
  materialType?: MaterialType;
  accessType?: AccessType;
  search?: string;
  sort?: 'recent' | 'oldest' | 'title' | 'downloads' | 'price-low' | 'price-high';
  page?: number;
  limit?: number;
}

export interface StudentProfileData {
  _id: string;
  className: string;
  board: BoardRef | null;
  schoolName?: string;
  guardianName?: string;
  mobile?: string;
}

export interface TeacherProfileData {
  _id: string;
  qualification?: string;
  bio?: string;
  photoUrl?: string;
  approved?: boolean;
  canManageAllMaterials?: boolean;
}

export interface SessionResponse {
  user: SessionUser & { lastLogin?: string };
  profile: StudentProfileData | TeacherProfileData | null;
}

export interface DownloadRecord {
  id: string;
  downloadedAt: string;
  material: Material;
}

export interface PurchaseRecord {
  id: string;
  amount: number;
  currency: string;
  paymentStatus: string;
  transactionId: string;
  purchaseDate: string;
  expiryDate: string;
  material: Material;
}

export interface StudentSummary {
  role: 'STUDENT';
  profile: StudentProfileData | null;
  stats: { downloads: number; purchases: number; favourites: number };
  purchases: { id: string; amount: number; purchaseDate: string; material: Material }[];
  recentDownloads: DownloadRecord[];
}

export interface StaffSummary {
  role: 'TEACHER' | 'ADMIN';
  profile: TeacherProfileData | null;
  stats: { total: number; published: number; drafts: number; downloads: number; revenue: number };
}

export type DashboardSummary = StudentSummary | StaffSummary;

export interface StaffDownload {
  id: string;
  downloadedAt: string;
  user: { name: string; email: string } | null;
  material: { title: string; className: string; materialType: MaterialType } | null;
}

export interface EnquiryItem {
  _id: string;
  name: string;
  mobile: string;
  email?: string;
  className: string;
  board: BoardRef | null;
  message: string;
  status: 'NEW' | 'CONTACTED' | 'CLOSED';
  createdAt: string;
}

export interface AdminOverview {
  users: number;
  students: number;
  teachers: number;
  pendingTeachers: number;
  materials: number;
  published: number;
  drafts: number;
  newEnquiries: number;
  revenue: number;
  downloads: number;
}

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface AdminTeacherProfile {
  _id: string;
  user: { name: string; email: string; isActive: boolean; createdAt: string } | null;
  qualification?: string;
  bio?: string;
  approved: boolean;
  canManageAllMaterials?: boolean;
  subjects: SubjectRef[];
}

export interface AdminStudentProfile {
  _id: string;
  user: { name: string; email: string; isActive: boolean; createdAt: string } | null;
  className: string;
  board: BoardRef | null;
  schoolName?: string;
  guardianName?: string;
  mobile?: string;
}
