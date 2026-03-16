import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import useApiMutation from "./useApiMutation";
import { queryKeys } from "../queryKeys";
import getUserAuth, { setUserAuth } from "../userAuth";
import { UPDATE_USER_PROFILE_URL } from "../../url";

export function useUpdateProfile(t) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const mutation = useApiMutation({
    method: "PUT",
    url: UPDATE_USER_PROFILE_URL,
  });

  const updateProfile = async (formData) => {
    const data = await mutation.mutateAsync({
      data: {
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        password: formData.password.trim(),
      },
    });

    const currentUser = await getUserAuth();
    const updatedUser = {
      ...currentUser,
      ...data?.user,
      auth_token: currentUser?.auth_token,
    };
    await setUserAuth(updatedUser);

    Toast.show({
      type: "success",
      text1: t("toast.success.title"),
      text2: t("toast.success.profileUpdated"),
    });
    queryClient.invalidateQueries({ queryKey: queryKeys.userProfile });
    router.back();
    return data;
  };

  return {
    updateProfile,
    isPending: mutation.isPending,
  };
}
