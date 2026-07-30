import { api } from "./http";

export type UserInvitationCreateResponse = {
  invitation_id: number;
  user_id: number;
  expires_at: string;
  activation_url: string;
};

export type UserInvitationListItem = {
  id: number;
  user_id: number;
  username: string;
  user_display_name: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  accepted_at?: string | null;
  revoked_at?: string | null;
  created_at: string;
  created_by: string;
  is_expired: boolean;
};

export type UserInvitationAcceptResponse = {
  detail: string;
};

export async function createUserInvitation(userId: number) {
  const response = await api.post<UserInvitationCreateResponse>(
    "/api/auth/invitations/",
    {
      user_id: userId,
    }
  );

  return response.data;
}

export async function listUserInvitations(params?: {
  userId?: number;
  status?: string;
}) {
  const response = await api.get<UserInvitationListItem[]>(
    "/api/auth/invitations/",
    {
      params: {
        user_id: params?.userId,
        status: params?.status,
      },
    }
  );

  return response.data;
}

export async function revokeUserInvitation(invitationId: number) {
  const response = await api.post<{ detail: string }>(
    `/api/auth/invitations/${invitationId}/revoke/`,
    {}
  );

  return response.data;
}

export async function acceptUserInvitation(
  token: string,
  password: string,
  passwordConfirm: string
) {
  const response = await api.post<UserInvitationAcceptResponse>(
    "/api/auth/invitations/accept/",
    {
      token,
      password,
      password_confirm: passwordConfirm,
    }
  );

  return response.data;
}
