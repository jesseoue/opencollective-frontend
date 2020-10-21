import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { FastField, Field } from 'formik';
import { first, get } from 'lodash';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { suggestSlug } from '../../lib/collective.lib';
import { AccountTypesWithHost } from '../../lib/constants/collectives';
import expenseTypes from '../../lib/constants/expenseTypes';
import { PayoutMethodType } from '../../lib/constants/payout-method';
import { ERROR, isErrorType } from '../../lib/errors';
import { formatFormErrorMessage } from '../../lib/form-utils';

import { Box, Flex, Grid } from '../Grid';
import PrivateInfoIcon from '../icons/PrivateInfoIcon';
import InputTypeCountry from '../InputTypeCountry';
import LoginBtn from '../LoginBtn';
import MessageBox from '../MessageBox';
import StyledButton from '../StyledButton';
import StyledCheckbox from '../StyledCheckbox';
import StyledHr from '../StyledHr';
import StyledInput from '../StyledInput';
import StyledInputField from '../StyledInputField';
import StyledInputGroup from '../StyledInputGroup';
import StyledTextarea from '../StyledTextarea';
import { Span } from '../Text';

import PayoutMethodForm from './PayoutMethodForm';
import PayoutMethodSelect from './PayoutMethodSelect';

const msg = defineMessages({
  nameLabel: {
    id: `ExpenseForm.inviteeLabel`,
    defaultMessage: 'Who will receive the money for this expense?',
  },
  emailLabel: {
    id: 'ExpenseForm.inviteeEmailLabel',
    defaultMessage: 'Your email address',
  },
  inviteeType: {
    id: 'ExpenseForm.inviteeIsOrganizationLabel',
    defaultMessage: 'Are you submitting this expense for your organization/company?',
  },
  orgNameLabel: {
    id: 'ExpenseForm.inviteeOrgNameLabel',
    defaultMessage: "What's the name of the organization?",
  },
  orgSlugLabel: {
    id: 'createCollective.form.slugLabel',
    defaultMessage: 'What URL would you like?',
  },
  orgWebsiteLabel: {
    id: 'ExpenseForm.inviteeOrgWebsiteLabel',
    defaultMessage: 'Organization website',
  },
  orgDescriptionLabel: {
    id: 'ExpenseForm.inviteeOrgDescriptionLabel',
    defaultMessage: 'What does your organization do?',
  },
  payoutOptionLabel: {
    id: `ExpenseForm.PayoutOptionLabel`,
    defaultMessage: 'Payout method',
  },
  invoiceInfo: {
    id: 'ExpenseForm.InvoiceInfo',
    defaultMessage: 'Additional invoice information',
  },
  invoiceInfoPlaceholder: {
    id: 'ExpenseForm.InvoiceInfoPlaceholder',
    defaultMessage: 'Tax ID, VAT number, etc. This information will be printed on your invoice.',
  },
  country: {
    id: 'ExpenseForm.ChooseCountry',
    defaultMessage: 'Choose country',
  },
  address: {
    id: 'ExpenseForm.AddressLabel',
    defaultMessage: 'Physical address',
  },
  stepPayee: {
    id: 'ExpenseForm.StepPayeeInvoice',
    defaultMessage: 'Payee information',
  },
});

const EMPTY_ARRAY = [];

const getPayoutMethodsFromPayee = payee => {
  const basePms = get(payee, 'payoutMethods') || EMPTY_ARRAY;
  let filteredPms = basePms.filter(({ isSaved }) => isSaved);

  // If the Payee is active (can manage a budget and has a balance). This is usually:
  // - a "Collective" family (Collective, Fund, Event, Project) with an host
  // - an "Host" Organization with budget activated
  if (payee?.isActive) {
    if (!filteredPms.find(pm => pm.type === PayoutMethodType.ACCOUNT_BALANCE)) {
      filteredPms.unshift({
        id: 'new',
        data: {},
        type: PayoutMethodType.ACCOUNT_BALANCE,
        isSaved: true,
      });
    }
  }

  // If the Payee is in the "Collective" family (Collective, Fund, Event, Project)
  // Then the Account Balance should be its only option
  if (payee && AccountTypesWithHost.includes(payee.type)) {
    filteredPms = filteredPms.filter(pm => pm.type === PayoutMethodType.ACCOUNT_BALANCE);
  }

  return filteredPms.length > 0 ? filteredPms : EMPTY_ARRAY;
};

const refreshPayoutProfile = (formik, payoutProfiles) => {
  const payee = formik.values.payee
    ? payoutProfiles.find(profile => profile.id === formik.values.payee.id)
    : first(payoutProfiles);

  formik.setFieldValue('payee', payee);
};

const ExpenseFormPayeeStep = ({ formik, payoutProfiles, collective, onCancel, onNext, isOnBehalf }) => {
  const intl = useIntl();
  const { formatMessage } = intl;
  const { values, errors } = formik;
  const stepOneCompleted = isOnBehalf
    ? values.payee
    : values.type === expenseTypes.RECEIPT
    ? values.payoutMethod
    : values.payoutMethod && values.payeeLocation?.country && values.payeeLocation?.address;

  const allPayoutMethods = React.useMemo(() => getPayoutMethodsFromPayee(values.payee, collective), [values.payee]);
  const onPayoutMethodRemove = React.useCallback(() => refreshPayoutProfile(formik, payoutProfiles), [payoutProfiles]);
  const setPayoutMethod = React.useCallback(({ value }) => formik.setFieldValue('payoutMethod', value), []);

  React.useEffect(() => {
    if (values.payee?.organization?.name) {
      formik.setFieldValue('payee.organization.slug', suggestSlug(values.payee.organization.name));
    }
  }, [values.payee?.organization?.name]);

  return (
    <Fragment>
      <Flex alignItems="center" mb={16}>
        <Span color="black.900" fontSize="16px" lineHeight="21px" fontWeight="bold">
          {formatMessage(msg.stepPayee)}
        </Span>
        <Box ml={2}>
          <PrivateInfoIcon size={12} color="#969BA3" tooltipProps={{ display: 'flex' }} />
        </Box>
        <StyledHr flex="1" borderColor="black.300" mx={2} />
      </Flex>

      <Box>
        <Field name="payee.isOrganization">
          {({ field }) => (
            <StyledCheckbox label={formatMessage(msg.inviteeType)} fontSize="13px" checked={field.value} {...field} />
          )}
        </Field>
      </Box>

      {values.payee?.isOrganization && (
        <Fragment>
          <Grid gridTemplateColumns={['100%', 'calc(50% - 8px) calc(50% - 8px)']} gridColumnGap={[null, 2, null, 3]}>
            <Field name="payee.organization.name">
              {({ field }) => (
                <StyledInputField name={field.name} label={formatMessage(msg.orgNameLabel)} labelFontSize="13px" mt={3}>
                  {inputProps => <StyledInput {...inputProps} {...field} placeholder="i.e. Airbnb, Salesforce" />}
                </StyledInputField>
              )}
            </Field>
            <Field name="payee.organization.slug">
              {({ field }) => (
                <StyledInputField name={field.name} label={formatMessage(msg.orgSlugLabel)} labelFontSize="13px" mt={3}>
                  {inputProps => <StyledInputGroup {...inputProps} {...field} prepend="opencollective.com/" />}
                </StyledInputField>
              )}
            </Field>
            <Field name="payee.organization.website">
              {({ field }) => (
                <StyledInputField
                  name={field.name}
                  label={formatMessage(msg.orgWebsiteLabel)}
                  labelFontSize="13px"
                  mt={3}
                >
                  {inputProps => <StyledInputGroup {...inputProps} {...field} prepend="http://" />}
                </StyledInputField>
              )}
            </Field>

            <Field name="payee.organization.description">
              {({ field }) => (
                <StyledInputField
                  name={field.name}
                  label={formatMessage(msg.orgDescriptionLabel)}
                  labelFontSize="13px"
                  mt={3}
                >
                  {inputProps => <StyledInput {...inputProps} {...field} placeholder="" />}
                </StyledInputField>
              )}
            </Field>
          </Grid>
          <MessageBox type="info" fontSize="12px" mt={16}>
            You selected an existing organization in Open Collective, you need to verify that you are an admin in order
            to continue with the submission. If you are not an admin you can submit the expense, but it will not be
            published until one of the organization admins approve it.
          </MessageBox>
        </Fragment>
      )}

      <Grid
        gridTemplateColumns={['100%', 'calc(50% - 8px) calc(50% - 8px)']}
        gridColumnGap={[null, 2, null, 3]}
        gridAutoFlow="dense"
      >
        <Box>
          <Field name="payee.name">
            {({ field }) => (
              <StyledInputField name={field.name} label={formatMessage(msg.nameLabel)} labelFontSize="13px" mt={3}>
                {inputProps => <StyledInput {...inputProps} {...field} />}
              </StyledInputField>
            )}
          </Field>
          {values.payee?.isOrganization && (
            <Span fontSize="11px" lineHeight="16px" color="black.600">
              You need to be an admin of the organization to submit expenses.
            </Span>
          )}
        </Box>
        <Box>
          <Field name="payee.email" required>
            {({ field }) => (
              <StyledInputField
                name={field.name}
                label={formatMessage(msg.emailLabel)}
                labelFontSize="13px"
                error={errors.payee?.email}
                mt={3}
              >
                {inputProps => <StyledInput {...inputProps} {...field} type="email" />}
              </StyledInputField>
            )}
          </Field>
          <Span fontSize="11px" lineHeight="16px" color="black.600">
            We will use this email to create your account. If you already have an account <LoginBtn asLink />.
          </Span>
        </Box>
        <FastField name="payeeLocation.country">
          {({ field }) => (
            <StyledInputField
              name={field.name}
              label={formatMessage(msg.country)}
              labelFontSize="13px"
              error={formatFormErrorMessage(intl, errors.payeeLocation?.country)}
              required
              mt={3}
            >
              {({ id, error }) => (
                <InputTypeCountry
                  data-cy="payee-country"
                  inputId={id}
                  onChange={value => formik.setFieldValue(field.name, value)}
                  value={field.value}
                  error={error}
                />
              )}
            </StyledInputField>
          )}
        </FastField>
        <Field name="payoutMethod">
          {({ field }) => (
            <StyledInputField
              name={field.name}
              htmlFor="payout-method"
              flex="1"
              mt={3}
              label={formatMessage(msg.payoutOptionLabel)}
              labelFontSize="13px"
              error={
                isErrorType(errors.payoutMethod, ERROR.FORM_FIELD_REQUIRED)
                  ? formatFormErrorMessage(intl, errors.payoutMethod)
                  : null
              }
            >
              {({ id, error }) => (
                <PayoutMethodSelect
                  inputId={id}
                  error={error}
                  onChange={setPayoutMethod}
                  onRemove={onPayoutMethodRemove}
                  payoutMethod={values.payoutMethod}
                  payoutMethods={allPayoutMethods}
                  payee={values.payee}
                  disabled={!values.payee}
                  collective={collective}
                />
              )}
            </StyledInputField>
          )}
        </Field>
        <FastField name="payeeLocation.address">
          {({ field }) => (
            <StyledInputField
              name={field.name}
              label={formatMessage(msg.address)}
              labelFontSize="13px"
              error={formatFormErrorMessage(intl, errors.payeeLocation?.address)}
              required
              mt={3}
            >
              {inputProps => (
                <StyledTextarea
                  {...inputProps}
                  {...field}
                  minHeight={100}
                  data-cy="payee-address"
                  placeholder="P. Sherman 42&#10;Wallaby Way&#10;Sydney"
                />
              )}
            </StyledInputField>
          )}
        </FastField>
        <FastField name="invoiceInfo">
          {({ field }) => (
            <StyledInputField
              name={field.name}
              label={formatMessage(msg.invoiceInfo)}
              labelFontSize="13px"
              required={false}
              mt={3}
              gridColumn={1}
            >
              {inputProps => (
                <Field
                  as={StyledTextarea}
                  {...inputProps}
                  {...field}
                  minHeight={80}
                  placeholder={formatMessage(msg.invoiceInfoPlaceholder)}
                />
              )}
            </StyledInputField>
          )}
        </FastField>

        {values.payoutMethod && (
          <Field name="payoutMethod">
            {({ field, meta }) => (
              <Box mt={3} flex="1">
                <PayoutMethodForm
                  fieldsPrefix="payoutMethod"
                  payoutMethod={field.value}
                  host={collective.host}
                  errors={meta.error}
                />
              </Box>
            )}
          </Field>
        )}
      </Grid>
      {values.payee && (
        <Fragment>
          <StyledHr flex="1" mt={4} borderColor="black.300" />
          <Flex mt={3} flexWrap="wrap">
            {onCancel && (
              <StyledButton
                type="button"
                width={['100%', 'auto']}
                mx={[2, 0]}
                mr={[null, 3]}
                mt={2}
                whiteSpace="nowrap"
                data-cy="expense-cancel"
                disabled={!stepOneCompleted}
                onClick={() => {
                  onCancel?.();
                }}
              >
                <FormattedMessage id="actions.cancel" defaultMessage="Cancel" />
              </StyledButton>
            )}
            <StyledButton
              type="button"
              width={['100%', 'auto']}
              mx={[2, 0]}
              mr={[null, 3]}
              mt={2}
              whiteSpace="nowrap"
              data-cy="expense-next"
              buttonStyle="primary"
              disabled={!stepOneCompleted}
              onClick={() => {
                onNext?.();
              }}
            >
              <FormattedMessage id="Pagination.Next" defaultMessage="Next" />
              &nbsp;→
            </StyledButton>
          </Flex>
        </Fragment>
      )}
    </Fragment>
  );
};

ExpenseFormPayeeStep.propTypes = {
  formik: PropTypes.object,
  payoutProfiles: PropTypes.array,
  onCancel: PropTypes.func,
  onNext: PropTypes.func,
  isOnBehalf: PropTypes.bool,
  collective: PropTypes.shape({
    slug: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    host: PropTypes.shape({
      transferwise: PropTypes.shape({
        availableCurrencies: PropTypes.arrayOf(PropTypes.object),
      }),
    }),
    settings: PropTypes.object,
  }).isRequired,
};

export default ExpenseFormPayeeStep;
