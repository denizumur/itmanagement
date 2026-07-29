import { api } from "./http";

export type UserInvitationCreateResponse = {
  invitation_id: number;
  user_id: number;
  expires_at: string;
  activation_url: string;
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
