import React from 'react';
import { Modal as MantineModal, Stack, Group, Divider } from '@mantine/core';

// Mantine-backed replacement for the old hand-rolled Modal. Keeps the same
// prop contract (isOpen/onClose/title/children/footer/wide) so every page
// that already renders <Modal ...> continues to work unchanged.
const Modal = ({ isOpen, onClose, title, children, footer, wide }) => (
  <MantineModal
    opened={!!isOpen}
    onClose={onClose}
    title={title}
    size={wide ? 'xl' : 'md'}
    radius="md"
    centered
  >
    <Stack gap="md">
      {children}
      {footer && (
        <>
          <Divider />
          <Group justify="flex-end" gap="sm">{footer}</Group>
        </>
      )}
    </Stack>
  </MantineModal>
);

export default Modal;
