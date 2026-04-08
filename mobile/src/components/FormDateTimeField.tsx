import { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../styles/theme';
import {
  formatDateInput,
  formatDateTimeInput,
  formatTimeInput,
  mergeDatePart,
  mergeTimePart,
  parseDateInput,
  parseDateTimeInput,
} from '../utils/dateTime';

type FieldMode = 'date' | 'datetime';

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  mode?: FieldMode;
  helperText?: string;
  optional?: boolean;
  style?: any;
};

export default function FormDateTimeField({
  label,
  value,
  onChangeText,
  placeholder,
  mode = 'date',
  helperText,
  optional,
  style,
}: Props) {
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const parsedDate = useMemo(
    () => (mode === 'datetime' ? parseDateTimeInput(value) : parseDateInput(value)),
    [mode, value]
  );
  const fallbackDate = useMemo(() => parsedDate || new Date(), [parsedDate]);

  const handleDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (!selectedDate) {
      setPickerMode(null);
      return;
    }
    if (mode === 'datetime') {
      onChangeText(mergeDatePart(value, selectedDate, fallbackDate));
    } else {
      onChangeText(formatDateInput(selectedDate));
    }
    if (Platform.OS === 'android') {
      setPickerMode(null);
    }
  };

  const handleTimeChange = (_event: DateTimePickerEvent, selectedTime?: Date) => {
    if (!selectedTime) {
      setPickerMode(null);
      return;
    }
    onChangeText(mergeTimePart(value, selectedTime, fallbackDate));
    if (Platform.OS === 'android') {
      setPickerMode(null);
    }
  };

  return (
    <View style={style}>
      <Text style={styles.label}>
        {label}
        {optional ? <Text style={styles.optionalText}> (optional)</Text> : null}
      </Text>
      <View style={[styles.row, mode === 'date' && styles.singleRow]}>
        <TouchableOpacity
          style={[styles.button, mode === 'date' && styles.singleButton]}
          onPress={() => setPickerMode('date')}
          activeOpacity={0.92}
        >
          <Ionicons name="calendar-outline" size={16} color={colors.primary} />
          <Text style={[styles.valueText, !parsedDate && styles.placeholderText]}>
            {parsedDate ? formatDateInput(parsedDate) : placeholder || 'Select date'}
          </Text>
        </TouchableOpacity>
        {mode === 'datetime' ? (
          <TouchableOpacity
            style={styles.button}
            onPress={() => setPickerMode('time')}
            activeOpacity={0.92}
          >
            <Ionicons name="time-outline" size={16} color={colors.primary} />
            <Text style={[styles.valueText, !parsedDate && styles.placeholderText]}>
              {parsedDate ? formatTimeInput(parsedDate) : 'Select time'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}

      {pickerMode === 'date' ? (
        <DateTimePicker
          value={fallbackDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handleDateChange}
        />
      ) : null}
      {pickerMode === 'time' ? (
        <DateTimePicker
          value={fallbackDate}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          is24Hour
          onChange={handleTimeChange}
        />
      ) : null}
      {mode === 'datetime' && parsedDate ? (
        <Text style={styles.summaryText}>{formatDateTimeInput(parsedDate)}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  optionalText: {
    color: colors.textMuted,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  singleRow: {
    gap: 0,
  },
  button: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  singleButton: {
    flex: 0,
    width: '100%',
  },
  valueText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  placeholderText: {
    color: colors.textSoft,
  },
  helperText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  summaryText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
