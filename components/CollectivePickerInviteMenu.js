import React from 'react';
import PropTypes from 'prop-types';
import { PlusCircle } from '@styled-icons/feather/PlusCircle';

import { isValidEmail } from '../lib/utils';

import { Box, Flex } from './Grid';
import StyledButton from './StyledButton';
import StyledInput from './StyledInput';
import StyledInputField from './StyledInputField';
import { Span } from './Text';

export const InviteCollectiveDropdownOption = ({ onClick }) => (
  <Flex flexDirection="column">
    <Flex mb="16px">
      <img width="48px" height="48px" src="/static/images/magnifier.png" />
      <Box ml="16px">
        <Span fontSize="12px" fontWeight="700" color="black.800">
          The person or organization you are looking for is not on Open Collective yet.
        </Span>
      </Box>
    </Flex>
    <StyledButton borderRadius="14px" onClick={onClick}>
      <Flex alignItems="center">
        <PlusCircle size={24} />
        <Box ml="16px" fontSize="11px">
          Invite someone to submit an expense
        </Box>
      </Flex>
    </StyledButton>
  </Flex>
);

InviteCollectiveDropdownOption.propTypes = {
  onClick: PropTypes.func.isRequired,
};

export const InviteCollectiveForm = ({ onCancel, onSave }) => {
  const [value, setValue] = React.useState({ name: '', email: '', isInvite: true });
  const setValueProp = prop => e => {
    e.persist();
    setValue(v => ({ ...v, [prop]: e.target?.value }));
  };

  return (
    <Flex flexDirection="column">
      <form
        onSubmit={e => {
          e.preventDefault();
          e.stopPropagation();
          onSave(value);
        }}
      >
        <StyledInputField
          label="What's the name of who you want to invite?"
          labelFontSize="13px"
          labelColor="black.700"
          labelProps={{ fontWeight: 600 }}
        >
          {() => (
            <StyledInput
              type="text"
              placeholder="i.e. John Smith"
              value={value.name}
              onChange={setValueProp('name')}
              mb="20px"
            />
          )}
        </StyledInputField>
        <StyledInputField
          label="What's their email?"
          labelFontSize="13px"
          labelColor="black.700"
          labelProps={{ fontWeight: 600 }}
        >
          {() => (
            <StyledInput
              type="email"
              placeholder="i.e. johnsmitgh@gmail.com"
              value={value.email}
              onChange={setValueProp('email')}
              mb="18px"
            />
          )}
        </StyledInputField>
        <Box>
          <StyledButton
            disabled={!isValidEmail(value.email)}
            buttonStyle="primary"
            buttonSize="small"
            mr={2}
            type="submit"
          >
            Save
          </StyledButton>
          <StyledButton buttonSize="small" onClick={() => onCancel()}>
            Cancel
          </StyledButton>
        </Box>
      </form>
    </Flex>
  );
};

InviteCollectiveForm.propTypes = {
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
