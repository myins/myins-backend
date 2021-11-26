export interface PendingUser {
  invitedBy: string;
  createdAt: Date;
  userId: string;
  userFirstName: string;
  userLastName: string;
  userProfilePicture: string | null;
  userIsDeleted: boolean;
  insId: string;
  insName: string;
  insCover: string | null;
  insShareCode: string;
  insCreatedAt: Date;
}
