/**
 * Model registry — one import site for every Mongoose model.
 *
 * Services import from here rather than from `src/models/*` directly so a model
 * is compiled exactly once per process (the `models.X ||` guard in each file
 * handles hot reload; this barrel keeps imports tidy).
 */

export { User, populateMember } from "@/models/user";
export { Counter } from "@/models/counter";
export { Category } from "@/models/category";
export { Book } from "@/models/book";
export { Loan } from "@/models/loan";
export { Fine } from "@/models/fine";
export { Reservation } from "@/models/reservation";
export { Wishlist } from "@/models/wishlist";
export { Review } from "@/models/review";
export { Notification } from "@/models/notification";
export { AuditLog } from "@/models/audit-log";
export { Setting } from "@/models/setting";
