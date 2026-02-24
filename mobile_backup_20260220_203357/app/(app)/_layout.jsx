import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* tabs and nested stacks live here */}
    </Stack>
  );
}
