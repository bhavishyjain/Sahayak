import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import useApiMutation from "./useApiMutation";
import {
  ACCEPT_INVITE_URL,
  FORGOT_PASSWORD_URL,
  LOGIN_URL,
  REGISTER_URL,
  RESEND_VERIFICATION_URL,
  RESET_PASSWORD_URL,
  VERIFY_EMAIL_URL,
} from "../../url";
import { finalizeAuthenticatedSession } from "../authSession";
import { getPostLoginRoute } from "../accountStatus";

export function useLoginAction(t) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutation = useApiMutation({ method: "POST", url: LOGIN_URL });

  const login = async ({ loginId, password }) => {
    const responseData = await mutation.mutateAsync({
      data: { loginId, password },
    });
    const authToken = responseData?.token;
    const userData = responseData?.user || {};

    if (!authToken) {
      throw new Error(t("toast.loginError.invalidToken"));
    }

    const userToStore = {
      ...userData,
      auth_token: authToken,
      token: authToken,
      refresh_token: responseData?.refreshToken || null,
    };
    await finalizeAuthenticatedSession(userToStore, { queryClient });

    Toast.show({
      type: "success",
      text1: t("toast.loginSuccess.title"),
      text2: responseData?.message || t("toast.loginSuccess.message"),
    });

    router.replace(getPostLoginRoute(userToStore));
    return responseData;
  };

  return {
    login,
    isLoading: mutation.isPending,
  };
}

export function useRegisterAction(t) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutation = useApiMutation({ method: "POST", url: REGISTER_URL });

  const register = async (data, options = {}) => {
    const responseData = await mutation.mutateAsync({ data });
    const authToken = responseData?.token;
    const userData = responseData?.user || {};

    if (!authToken) {
      throw new Error(
        responseData?.message || t("toast.registerError.tokenNotReturned"),
      );
    }

    await finalizeAuthenticatedSession(
      {
        ...userData,
        auth_token: authToken,
        token: authToken,
      },
      { queryClient },
    );

    Toast.show({
      type: "success",
      text1: t("toast.registerSuccess.title"),
      text2: responseData?.message || t("toast.registerSuccess.message"),
    });

    if (options.invitationFlow) {
      router.replace(
        userData.role === "head"
          ? "/(app)/(tabs)/hod-home"
          : "/(app)/(tabs)/worker-home",
      );
    } else if (userData.role === "user") {
      router.replace({
        pathname: "/(app)/(auth)/verify-email",
        params: { email: userData.email || data.email },
      });
    } else {
      router.replace("/(app)/(tabs)/home");
    }

    return responseData;
  };

  return { register, isLoading: mutation.isPending };
}

export function useForgotPasswordAction(t) {
  const mutation = useApiMutation({
    method: "POST",
    url: FORGOT_PASSWORD_URL,
  });

  const submit = async (email) => {
    const response = await mutation.mutateAsync({
      data: { email },
    });
    Toast.show({
      type: "success",
      text1: t("auth.forgotPassword.checkEmailTitle"),
      text2: response?.message || t("auth.forgotPassword.checkEmailMessage"),
    });
    return response;
  };

  return { submit, isLoading: mutation.isPending };
}

export function useResetPasswordAction(t) {
  const router = useRouter();
  const mutation = useApiMutation({ method: "POST" });

  const resetPassword = async ({ token, password }) => {
    const response = await mutation.mutateAsync({
      urlOverride: RESET_PASSWORD_URL(token),
      data: { password },
    });
    Toast.show({
      type: "success",
      text1: t("auth.resetPassword.updatedTitle"),
      text2: response?.message || t("auth.resetPassword.updatedMessage"),
    });
    router.replace("/(app)/(auth)/login");
    return response;
  };

  return { resetPassword, isLoading: mutation.isPending };
}

export function useVerifyEmailActions(t) {
  const verifyMutation = useApiMutation({ method: "GET" });
  const resendMutation = useApiMutation({
    method: "POST",
    url: RESEND_VERIFICATION_URL,
  });

  return {
    verifyEmail: async (token) =>
      verifyMutation.mutateAsync({
        urlOverride: VERIFY_EMAIL_URL(token),
      }),
    resendVerification: async () => {
      const response = await resendMutation.mutateAsync();
      Toast.show({
        type: "success",
        text1: t("auth.verifyEmail.resendSentTitle"),
        text2: response?.message || t("auth.verifyEmail.resendSentMessage"),
      });
      return response;
    },
    isVerifying: verifyMutation.isPending,
    isResending: resendMutation.isPending,
  };
}

export function useAcceptInviteAction(t) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutation = useApiMutation({ method: "POST", url: ACCEPT_INVITE_URL });

  const acceptInvite = async (inviteToken) => {
    const responseData = await mutation.mutateAsync({
      data: { inviteToken },
    });
    const newJwt = responseData?.token;
    const updatedUser = responseData?.user;
    if (newJwt && updatedUser) {
      await finalizeAuthenticatedSession(
        { ...updatedUser, auth_token: newJwt, token: newJwt },
        { queryClient },
      );
    }

    Toast.show({
      type: "success",
      text1: t("auth.acceptInvite.toast.welcomeTitle"),
      text2: `${t("auth.acceptInvite.toast.welcomeMessage")} ${updatedUser?.department || ""}`.trim(),
    });

    router.replace(
      updatedUser?.role === "head"
        ? "/(app)/(tabs)/hod-home"
        : "/(app)/(tabs)/worker-home",
    );

    return responseData;
  };

  return { acceptInvite, isLoading: mutation.isPending };
}
