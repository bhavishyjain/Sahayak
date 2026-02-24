import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, Text, Vibration, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { darkColors, lightColors } from "../colors";
import { useTheme } from "../utils/context/theme";
import { useTranslation } from "../utils/i18n/LanguageProvider";
import PressableBlock from "./PressableBlock";

const ITEM_HEIGHT = 42;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function WheelColumn({
  data,
  initialIndex = 0,
  onIndexChange,
  textColor,
  mutedColor,
  width = 90,
}) {
  const scrollRef = useRef(null);
  const padCount = Math.floor(VISIBLE_ITEMS / 2);

  const scrollY = useRef(
    new Animated.Value(initialIndex * ITEM_HEIGHT),
  ).current;
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);

  const isProgrammaticScroll = useRef(false);
  const lastCommittedIndex = useRef(initialIndex);
  const momentumStarted = useRef(false);

  // Initialize scroll position
  useEffect(() => {
    const id = setTimeout(() => {
      isProgrammaticScroll.current = true;

      scrollRef.current?.scrollTo({
        y: initialIndex * ITEM_HEIGHT,
        animated: false,
      });

      scrollY.setValue(initialIndex * ITEM_HEIGHT);
      setSelectedIndex(initialIndex);
      lastCommittedIndex.current = initialIndex;

      setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 100);
    }, 50);

    return () => clearTimeout(id);
  }, [initialIndex]);

  const snapToNearestItem = (offsetY) => {
    const idx = clamp(Math.round(offsetY / ITEM_HEIGHT), 0, data.length - 1);
    const snapY = idx * ITEM_HEIGHT;

    isProgrammaticScroll.current = true;

    scrollRef.current?.scrollTo({
      y: snapY,
      animated: true,
    });

    // Haptic feedback - light vibration
    Vibration.vibrate(2);

    // Update state
    if (idx !== lastCommittedIndex.current) {
      lastCommittedIndex.current = idx;
      setSelectedIndex(idx);
      onIndexChange?.(idx);
    }

    setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 300);
  };

  const handleScrollEndDrag = (event) => {
    if (isProgrammaticScroll.current) return;

    const velocity = event.nativeEvent.velocity?.y || 0;

    // If there's significant velocity, momentum will start
    if (Math.abs(velocity) > 0.5) {
      momentumStarted.current = true;
      return; // Let momentum handle it
    }

    // Slow drag - snap immediately
    momentumStarted.current = false;
    const y = event.nativeEvent.contentOffset.y;
    snapToNearestItem(y);
  };

  const handleMomentumScrollEnd = (event) => {
    if (isProgrammaticScroll.current) return;

    // Only snap if momentum actually happened
    if (momentumStarted.current) {
      const y = event.nativeEvent.contentOffset.y;
      snapToNearestItem(y);
      momentumStarted.current = false;
    }
  };

  return (
    <View style={{ height: PICKER_HEIGHT, width }}>
      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        decelerationRate="normal"
        bounces={false}
        overScrollMode="never"
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        contentContainerStyle={{
          paddingTop: padCount * ITEM_HEIGHT,
          paddingBottom: padCount * ITEM_HEIGHT,
        }}
      >
        {data.map((item, index) => {
          const inputRange = [
            (index - 1) * ITEM_HEIGHT,
            index * ITEM_HEIGHT,
            (index + 1) * ITEM_HEIGHT,
          ];

          const opacity = scrollY.interpolate({
            inputRange,
            outputRange: [0.35, 1, 0.35],
            extrapolate: "clamp",
          });

          const scale = scrollY.interpolate({
            inputRange,
            outputRange: [0.85, 1.15, 0.85],
            extrapolate: "clamp",
          });

          return (
            <Animated.View
              key={index}
              style={{
                height: ITEM_HEIGHT,
                justifyContent: "center",
                alignItems: "center",
                opacity,
                transform: [{ scale }],
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: textColor,
                }}
              >
                {item}
              </Text>
            </Animated.View>
          );
        })}
      </Animated.ScrollView>
    </View>
  );
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function formatDateDisplay(dateString) {
  // Input: "2026-01-29" -> Output: "29.01.2026"
  // Also handles Date objects for backward compatibility
  if (!dateString) return null;

  // If it's a Date object, convert it
  if (dateString instanceof Date) {
    const day = pad2(dateString.getDate());
    const month = pad2(dateString.getMonth() + 1);
    const year = dateString.getFullYear();
    return `${day}.${month}.${year}`;
  }

  // If it's a string, parse it
  if (typeof dateString === "string") {
    const parts = dateString.split("-");
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }

  return null;
}

function parseDateString(dateString) {
  // Parse "2026-01-29" into year, month, day
  // Also handles Date objects for backward compatibility
  if (!dateString) return null;

  // If it's a Date object, convert it
  if (dateString instanceof Date) {
    return {
      year: dateString.getFullYear(),
      month: dateString.getMonth() + 1,
      day: dateString.getDate(),
    };
  }

  // If it's a string, parse it
  if (typeof dateString === "string") {
    const parts = dateString.split("-");
    return {
      year: parseInt(parts[0]),
      month: parseInt(parts[1]),
      day: parseInt(parts[2]),
    };
  }

  return null;
}

function parseTimeString(timeString) {
  // Parse "08:00" into hour, minute
  // Also handles Date objects for backward compatibility
  if (!timeString) return null;

  // If it's a Date object, convert it
  if (timeString instanceof Date) {
    return {
      hour: timeString.getHours(),
      minute: timeString.getMinutes(),
    };
  }

  // If it's a string, parse it
  if (typeof timeString === "string") {
    const parts = timeString.split(":");
    return {
      hour: parseInt(parts[0]),
      minute: parseInt(parts[1]),
    };
  }

  return null;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isBeforeDay(a, b) {
  return startOfDay(a).getTime() < startOfDay(b).getTime();
}

export default function DateTimePickerModal({
  mode = "date", // "date" or "time"
  value, // For date mode: "2026-01-29", for time mode: "08:00"
  onChange,
  icon: Icon,
  label,
  disablePastDates = false,
  maxDateToday = false,
  containerStyle,
  placeholder,
}) {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const { t } = useTranslation();

  const [show, setShow] = useState(false);

  // Date state
  const today = useMemo(() => startOfDay(new Date()), []);
  const minDate = disablePastDates ? today : null;
  const maxDate = maxDateToday ? today : null;

  const parsedDate = useMemo(() => {
    if (mode === "date" && value) {
      return parseDateString(value);
    }
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
    };
  }, [value, mode]);

  const parsedTime = useMemo(() => {
    if (mode === "time" && value) {
      return parseTimeString(value);
    }
    return { hour: 0, minute: 0 };
  }, [value, mode]);

  const [year, setYear] = useState(parsedDate.year);
  const [month, setMonth] = useState(parsedDate.month);
  const [day, setDay] = useState(parsedDate.day);

  // Time state
  const [hour, setHour] = useState(parsedTime.hour);
  const [minute, setMinute] = useState(parsedTime.minute);

  // Date data
  const yearsData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const start = disablePastDates ? currentYear : currentYear - 2;
    const end = maxDateToday ? currentYear : currentYear + 2;
    return Array.from({ length: end - start + 1 }, (_, i) => String(start + i));
  }, [disablePastDates, maxDateToday]);

  const monthsData = useMemo(() => {
    const now = new Date();
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth() + 1;

    let startMonth = 1;
    let endMonth = 12;

    if (disablePastDates && year === nowYear) {
      startMonth = nowMonth;
    }

    if (maxDateToday && year === nowYear) {
      endMonth = nowMonth;
    }

    const length = endMonth - startMonth + 1;
    return Array.from({ length }, (_, i) => pad2(startMonth + i));
  }, [year, disablePastDates, maxDateToday]);

  const daysData = useMemo(() => {
    const maxDays = daysInMonth(year, month - 1);

    let startDay = 1;
    let endDay = maxDays;

    if (disablePastDates) {
      const now = new Date();
      const nowYear = now.getFullYear();
      const nowMonth = now.getMonth() + 1;
      const nowDay = now.getDate();

      if (year === nowYear && month === nowMonth) {
        startDay = nowDay;
      }
    }

    if (maxDateToday) {
      const now = new Date();
      const nowYear = now.getFullYear();
      const nowMonth = now.getMonth() + 1;
      const nowDay = now.getDate();

      if (year === nowYear && month === nowMonth) {
        endDay = nowDay;
      }
    }

    const length = endDay - startDay + 1;
    return Array.from({ length }, (_, i) => pad2(startDay + i));
  }, [year, month, disablePastDates, maxDateToday]);

  // Time data
  const hoursData = useMemo(
    () => Array.from({ length: 24 }, (_, i) => pad2(i)),
    [],
  );
  const minutesData = useMemo(
    () => Array.from({ length: 60 }, (_, i) => pad2(i)),
    [],
  );

  useEffect(() => {
    if (mode === "date") {
      const maxDays = daysInMonth(year, month - 1);
      if (day > maxDays) setDay(maxDays);
    }
  }, [year, month, mode]);

  const monthInitialIndex = useMemo(() => {
    const idx = monthsData.indexOf(pad2(month));
    return idx >= 0 ? idx : 0;
  }, [monthsData, month]);

  const dayInitialIndex = useMemo(() => {
    const idx = daysData.indexOf(pad2(day));
    return idx >= 0 ? idx : 0;
  }, [daysData, day]);

  const yearInitialIndex = useMemo(() => {
    const idx = yearsData.indexOf(String(year));
    return idx >= 0 ? idx : 0;
  }, [yearsData, year]);

  useEffect(() => {
    if (mode !== "date" || (!disablePastDates && !maxDateToday)) return;

    const selected = new Date();
    selected.setFullYear(year);
    selected.setMonth(month - 1);
    selected.setDate(day);
    selected.setHours(0, 0, 0, 0);

    if (disablePastDates && minDate && isBeforeDay(selected, minDate)) {
      setYear(minDate.getFullYear());
      setMonth(minDate.getMonth() + 1);
      setDay(minDate.getDate());
    }

    if (maxDateToday && maxDate && isBeforeDay(maxDate, selected)) {
      setYear(maxDate.getFullYear());
      setMonth(maxDate.getMonth() + 1);
      setDay(maxDate.getDate());
    }
  }, [
    year,
    month,
    day,
    mode,
    disablePastDates,
    maxDateToday,
    minDate,
    maxDate,
  ]);

  const displayValue = useMemo(() => {
    if (!value) return null;
    if (mode === "date") {
      return formatDateDisplay(value); // "2026-01-29" -> "29.01.2026" or Date object -> "29.01.2026"
    } else {
      // Handle time string or Date object
      if (typeof value === "string") {
        return value; // "08:00"
      } else if (value instanceof Date) {
        return `${pad2(value.getHours())}:${pad2(value.getMinutes())}`;
      }
      return null;
    }
  }, [value, mode]);

  const selectedDisplayText = useMemo(() => {
    if (mode === "date") {
      const dateString = `${year}-${pad2(month)}-${pad2(day)}`;
      return formatDateDisplay(dateString);
    } else {
      return `${pad2(hour)}:${pad2(minute)}`;
    }
  }, [year, month, day, hour, minute, mode]);

  useEffect(() => {
    if (!maxDateToday || mode !== "date") return;

    const now = new Date();
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth() + 1;
    const nowDay = now.getDate();

    // If year is current year, month cannot exceed current month
    if (year === nowYear && month > nowMonth) {
      setMonth(nowMonth);
      setDay(nowDay);
      return;
    }

    // If year/month is current, day cannot exceed today
    if (year === nowYear && month === nowMonth && day > nowDay) {
      setDay(nowDay);
    }
  }, [year, month, day, maxDateToday, mode]);

  const open = () => {
    if (mode === "date") {
      const parsed = value ? parseDateString(value) : null;
      const base = parsed || {
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        day: new Date().getDate(),
      };

      // Check constraints
      const baseDate = new Date();
      baseDate.setFullYear(base.year);
      baseDate.setMonth(base.month - 1);
      baseDate.setDate(base.day);
      baseDate.setHours(0, 0, 0, 0);

      if (disablePastDates && minDate && isBeforeDay(baseDate, minDate)) {
        setYear(minDate.getFullYear());
        setMonth(minDate.getMonth() + 1);
        setDay(minDate.getDate());
      } else if (maxDateToday && maxDate && isBeforeDay(maxDate, baseDate)) {
        setYear(maxDate.getFullYear());
        setMonth(maxDate.getMonth() + 1);
        setDay(maxDate.getDate());
      } else {
        setYear(base.year);
        setMonth(base.month);
        setDay(base.day);
      }
    } else {
      const parsed = value ? parseTimeString(value) : null;
      const base = parsed || { hour: 0, minute: 0 };
      setHour(base.hour);
      setMinute(base.minute);
    }

    setShow(true);
  };

  const confirm = () => {
    if (mode === "date") {
      let selected = new Date();
      selected.setFullYear(year);
      selected.setMonth(month - 1);
      selected.setDate(day);
      selected.setHours(0, 0, 0, 0);

      if (disablePastDates && minDate && isBeforeDay(selected, minDate)) {
        selected = new Date(minDate);
      }

      if (maxDateToday && maxDate && isBeforeDay(maxDate, selected)) {
        selected = new Date(maxDate);
      }

      // Return date-only string in YYYY-MM-DD format
      const dateString = `${selected.getFullYear()}-${pad2(selected.getMonth() + 1)}-${pad2(selected.getDate())}`;
      onChange?.(dateString);
    } else {
      // Return time-only string in HH:MM format
      const timeString = `${pad2(hour)}:${pad2(minute)}`;
      onChange?.(timeString);
    }

    setShow(false);
  };

  return (
    <>
      <PressableBlock
        onPress={open}
        className="rounded-xl px-4 mb-4 justify-center h-[50px]"
        style={[
          {
            backgroundColor: colors.backgroundPrimary,
            borderWidth: 1,
            borderColor: colors.textSecondary + "20",
          },
          containerStyle,
        ]}
      >
        <View className="flex-row items-center">
          {Icon && <Icon size={18} color={colors.textSecondary} />}
          <Text
            className="text-base"
            style={{
              color: displayValue ? colors.textPrimary : colors.textSecondary,
              marginLeft: Icon ? 8 : 0,
            }}
          >
            {displayValue ||
              placeholder ||
              (mode === "date" ? "Select date" : "Select time")}
          </Text>
        </View>
      </PressableBlock>

      <Modal visible={show} transparent animationType="slide">
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.45)",
          }}
        >
          <SafeAreaView
            edges={["bottom"]}
            style={{
              backgroundColor: colors.backgroundSecondary,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                backgroundColor: colors.backgroundSecondary,
                paddingBottom: 14,
              }}
            >
              <View
                style={{
                  paddingTop: 14,
                  paddingBottom: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.muted,
                }}
              >
                <Text
                  style={{
                    textAlign: "center",
                    fontSize: 14,
                    fontWeight: "600",
                    color: colors.textSecondary,
                    marginBottom: 6,
                  }}
                >
                  {label || (mode === "date" ? "Select Date" : "Select Time")}
                </Text>

                <Text
                  style={{
                    textAlign: "center",
                    fontSize: 22,
                    fontWeight: "800",
                    color: colors.textPrimary,
                    letterSpacing: 1,
                  }}
                >
                  {selectedDisplayText}
                </Text>
              </View>

              <View
                style={{
                  height: PICKER_HEIGHT,
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                  paddingVertical: 10,
                }}
              >
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: 20,
                    right: 20,
                    top: (PICKER_HEIGHT - ITEM_HEIGHT) / 2,
                    height: ITEM_HEIGHT,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.muted,
                    backgroundColor: "rgba(255,255,255,0.03)",
                  }}
                />

                {mode === "date" ? (
                  <>
                    <WheelColumn
                      data={daysData}
                      initialIndex={dayInitialIndex}
                      onIndexChange={(idx) => setDay(parseInt(daysData[idx]))}
                      textColor={colors.textPrimary}
                      mutedColor={colors.textSecondary}
                      width={80}
                    />

                    <WheelColumn
                      data={monthsData}
                      initialIndex={monthInitialIndex}
                      onIndexChange={(idx) =>
                        setMonth(parseInt(monthsData[idx]))
                      }
                      textColor={colors.textPrimary}
                      mutedColor={colors.textSecondary}
                      width={80}
                    />

                    <WheelColumn
                      data={yearsData}
                      initialIndex={yearInitialIndex}
                      onIndexChange={(idx) => setYear(Number(yearsData[idx]))}
                      textColor={colors.textPrimary}
                      mutedColor={colors.textSecondary}
                      width={110}
                    />
                  </>
                ) : (
                  <>
                    <WheelColumn
                      data={hoursData}
                      initialIndex={hour}
                      onIndexChange={setHour}
                      textColor={colors.textPrimary}
                      mutedColor={colors.textSecondary}
                    />

                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "700",
                        marginHorizontal: 6,
                        color: colors.textSecondary,
                      }}
                    >
                      :
                    </Text>

                    <WheelColumn
                      data={minutesData}
                      initialIndex={minute}
                      onIndexChange={setMinute}
                      textColor={colors.textPrimary}
                      mutedColor={colors.textSecondary}
                    />
                  </>
                )}
              </View>

              <PressableBlock
                onPress={confirm}
                className="py-4 mx-4 mb-3 rounded-xl active:opacity-80"
                style={{ backgroundColor: colors.primary }}
              >
                <Text
                  style={{
                    textAlign: "center",
                    fontSize: 16,
                    fontWeight: "700",
                    color: colors.dark,
                  }}
                >
                  {t("common.confirm")}
                </Text>
              </PressableBlock>

              <PressableBlock
                onPress={() => setShow(false)}
                className="py-4 mx-4 mb-2 rounded-xl active:opacity-80"
                style={{
                  backgroundColor: colors.backgroundSecondary,
                  borderWidth: 1,
                  borderColor: colors.muted,
                }}
              >
                <Text
                  style={{
                    textAlign: "center",
                    fontSize: 16,
                    fontWeight: "600",
                    color: colors.textSecondary,
                  }}
                >
                  {t("common.cancel")}
                </Text>
              </PressableBlock>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}
