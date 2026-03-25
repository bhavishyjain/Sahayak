import { router } from "expo-router";
import getUserAuth, { setUserAuth } from "./userAuth";

export async function markAccountDeactivated() {
  const currentUser = await getUserAuth();
  if (!currentUser) {
    router.replace("/(app)/(auth)/login");
    return;
  }

  await setUserAuth({
    ...currentUser,
    isActive: false,
  });
  router.replace("/(app)/account-deactivated");
}

export function getPostLoginRoute(user) {
  if (user?.isActive === false) {
    return "/(app)/account-deactivated";
  }

  if (user?.role === "admin") return "/(app)/(tabs)/admin-home";
  if (user?.role === "head") return "/(app)/(tabs)/hod-overview";
  if (user?.role === "worker") return "/(app)/(tabs)/worker-home";
  return "/(app)/(tabs)/home";
}
