import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Dispatch } from 'react';
import type { Action } from '~/utils/types';
import type { AppConfig } from '~/utils/config';
import { saveConfig } from '~/utils/config';

interface PreferencesDialogProps {
  config: AppConfig;
  dispatch: Dispatch<Action>;
}

export function PreferencesDialog({ config, dispatch }: PreferencesDialogProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState('');

  useInput((input, key) => {
    if (editing) {
      if (key.escape) {
        setEditing(false);
        setError('');
        return;
      }
      if (key.return) {
        const trimmed = editValue.trim();
        const newLocale = trimmed === '' ? undefined : trimmed;

        if (newLocale !== undefined) {
          try {
            new Intl.DateTimeFormat(newLocale);
          } catch {
            setError(`Invalid locale: "${trimmed}"`);
            return;
          }
        }

        const newConfig = { ...config, dateLocale: newLocale };
        dispatch({ type: 'UPDATE_CONFIG', config: newConfig });
        saveConfig(newConfig);
        setEditing(false);
        setError('');
        return;
      }
      if (key.backspace || key.delete) {
        setEditValue(v => v.slice(0, -1));
        setError('');
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setEditValue(v => v + input);
        setError('');
      }
      return;
    }

    if (key.escape || input === ',') {
      dispatch({ type: 'TOGGLE_PREFERENCES' });
      return;
    }
    if (key.return) {
      setEditing(true);
      setEditValue(config.dateLocale ?? '');
      setError('');
    }
  });

  const displayValue = config.dateLocale ?? '(system default)';

  return (
    <Box
      position="absolute"
      flexDirection="column"
      borderStyle="double"
      borderColor="yellow"
      paddingX={2}
      paddingY={1}
      marginLeft={10}
      marginTop={3}
    >
      <Text bold underline>Preferences</Text>
      <Text> </Text>
      {editing ? (
        <Box flexDirection="column">
          <Text>
            <Text bold>Date locale: </Text>
            <Text inverse>{editValue || ' '}</Text>
          </Text>
          {error ? (
            <Text color="red">{error}</Text>
          ) : (
            <Text dimColor>Enter to save, Esc to cancel, empty for system default</Text>
          )}
        </Box>
      ) : (
        <Box flexDirection="column">
          <Text>
            <Text bold inverse> Date locale </Text>
            <Text> {displayValue}</Text>
          </Text>
          <Text dimColor>Enter to edit, Esc or , to close</Text>
        </Box>
      )}
    </Box>
  );
}
