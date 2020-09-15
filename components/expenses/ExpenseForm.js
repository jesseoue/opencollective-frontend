import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { FastField, Field, FieldArray, Form, Formik } from 'formik';
import { first, get, isEmpty, pick } from 'lodash';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import styled from 'styled-components';

import { CollectiveFamilyTypes, CollectiveType } from '../../lib/constants/collectives';
import expenseTypes from '../../lib/constants/expenseTypes';
import { PayoutMethodType } from '../../lib/constants/payout-method';
import { ERROR, isErrorType } from '../../lib/errors';
import { formatFormErrorMessage, requireFields } from '../../lib/form-utils';

import CollectivePicker from '../CollectivePicker';
import { Box, Flex } from '../Grid';
import PrivateInfoIcon from '../icons/PrivateInfoIcon';
import InputTypeCountry from '../InputTypeCountry';
import StyledButton from '../StyledButton';
import StyledCard from '../StyledCard';
import StyledHr from '../StyledHr';
import StyledInput from '../StyledInput';
import StyledInputField from '../StyledInputField';
import StyledInputTags from '../StyledInputTags';
import StyledTextarea from '../StyledTextarea';
import { P, Span } from '../Text';

import ExpenseAttachedFilesForm from './ExpenseAttachedFilesForm';
import ExpenseFormItems, { addNewExpenseItem } from './ExpenseFormItems';
import { validateExpenseItem } from './ExpenseItemForm';
import ExpensePayeeDetails from './ExpensePayeeDetails';
import ExpenseTypeRadioSelect from './ExpenseTypeRadioSelect';
import ExpenseTypeTag from './ExpenseTypeTag';
import PayoutMethodForm, { validatePayoutMethod } from './PayoutMethodForm';
import PayoutMethodSelect from './PayoutMethodSelect';

const msg = defineMessages({
  descriptionPlaceholder: {
    id: `ExpenseForm.DescriptionPlaceholder`,
    defaultMessage: 'Enter expense title here...',
  },
  subjectPlaceholder: {
    id: `ExpenseForm.RequestSubjectPlaceholder`,
    defaultMessage: 'Enter request subject here...',
  },
  payeeLabel: {
    id: `ExpenseForm.payeeLabel`,
    defaultMessage: 'Who is being paid for this expense?',
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
  leaveWithUnsavedChanges: {
    id: 'ExpenseForm.UnsavedChangesWarning',
    defaultMessage: 'If you cancel now you will loose any changes made to this expense. Are you sure?',
  },
  addNewReceipt: {
    id: 'ExpenseForm.AddReceipt',
    defaultMessage: 'Add new receipt',
  },
  addNewItem: {
    id: 'ExpenseForm.AddLineItem',
    defaultMessage: 'Add new item',
  },
  stepReceipt: {
    id: 'ExpenseForm.StepExpense',
    defaultMessage: 'Upload one or multiple receipt',
  },
  stepInvoice: {
    id: 'ExpenseForm.StepExpenseInvoice',
    defaultMessage: 'Set invoice details',
  },
  stepFundingRequest: {
    id: 'ExpenseForm.StepExpenseFundingRequest',
    defaultMessage: 'Set grant request details',
  },
  stepPayee: {
    id: 'ExpenseForm.StepPayeeInvoice',
    defaultMessage: 'Payee information',
  },
  next: {
    id: 'Pagination.Next',
    defaultMessage: 'Next',
  },
  back: {
    id: 'Back',
    defaultMessage: 'Back',
  },
});

const getDefaultExpense = collective => ({
  description: '',
  longDescription: '',
  items: [],
  attachedFiles: [],
  payee: null,
  payoutMethod: undefined,
  privateMessage: '',
  invoiceInfo: '',
  currency: collective.currency,
  payeeLocation: {
    address: '',
    country: null,
  },
});

/**
 * Take the expense's data as generated by `ExpenseForm` and strips out all optional data
 * like URLs for items when the expense is an invoice.
 */
export const prepareExpenseForSubmit = expenseData => {
  // The collective picker still uses API V1 for when creating a new profile on the fly
  const payeeIdField = typeof expenseData.payee?.id === 'string' ? 'id' : 'legacyId';
  const isInvoice = expenseData.type === expenseTypes.INVOICE;
  const isFundingRequest = expenseData.type === expenseTypes.FUNDING_REQUEST;
  return {
    ...pick(expenseData, ['id', 'description', 'longDescription', 'type', 'privateMessage', 'invoiceInfo', 'tags']),
    payee: expenseData.payee && { [payeeIdField]: expenseData.payee.id },
    payoutMethod: pick(expenseData.payoutMethod, ['id', 'name', 'data', 'isSaved', 'type']),
    payeeLocation: isInvoice ? pick(expenseData.payeeLocation, ['address', 'country']) : null,
    attachedFiles: isInvoice ? expenseData.attachedFiles?.map(file => pick(file, ['id', 'url'])) : [],
    // Omit item's ids that were created for keying purposes
    items: expenseData.items.map(item => {
      return pick(item, [
        ...(item.__isNew ? [] : ['id']),
        ...(isInvoice || isFundingRequest ? [] : ['url']), // never submit URLs for invoices or requests
        'description',
        'incurredAt',
        'amount',
      ]);
    }),
  };
};

/**
 * Validate the expense
 */
const validate = expense => {
  const errors = requireFields(expense, ['description', 'payee', 'payoutMethod', 'currency']);

  if (expense.items.length > 0) {
    const itemsErrors = expense.items.map(item => validateExpenseItem(expense, item));
    const hasErrors = itemsErrors.some(errors => !isEmpty(errors));
    if (hasErrors) {
      errors.items = itemsErrors;
    }
  }

  if (expense.payoutMethod) {
    const payoutMethodErrors = validatePayoutMethod(expense.payoutMethod);
    if (!isEmpty(payoutMethodErrors)) {
      errors.payoutMethod = payoutMethodErrors;
    }
  }

  if (expense.type === expenseTypes.INVOICE) {
    Object.assign(errors, requireFields(expense, ['payeeLocation.country', 'payeeLocation.address']));
  }

  return errors;
};

const EMPTY_ARRAY = [];

// Margin x between inline fields, not displayed on mobile
const fieldsMarginRight = [2, 3, 4];

const setLocationFromPayee = (formik, payee) => {
  formik.setFieldValue('payeeLocation.country', payee.location.country || null);
  formik.setFieldValue('payeeLocation.address', payee.location.address || '');
};

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
  if (payee && CollectiveFamilyTypes.includes(payee.type)) {
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

const HiddenStep = styled.div`
  display: ${({ show }) => (show ? 'block' : 'none')};
`;

const STEPS = {
  PAYEE: 'PAYEE',
  EXPENSE: 'EXPENSE',
};

const ExpenseFormBody = ({
  formik,
  payoutProfiles,
  collective,
  autoFocusTitle,
  onCancel,
  formPersister,
  expensesTags,
  shouldLoadValuesFromPersister,
}) => {
  const intl = useIntl();
  const { formatMessage } = intl;
  const { values, handleChange, errors, setValues, dirty } = formik;
  const hasBaseFormFieldsCompleted = values.type && values.description;
  const stepOneCompleted = values.payoutMethod;
  const stepTwoCompleted = stepOneCompleted && hasBaseFormFieldsCompleted && values.items.length > 0;
  const isReceipt = values.type === expenseTypes.RECEIPT;
  const isFundingRequest = values.type === expenseTypes.FUNDING_REQUEST;
  const [step, setStep] = React.useState(stepOneCompleted ? STEPS.EXPENSE : STEPS.PAYEE);
  const allPayoutMethods = React.useMemo(() => getPayoutMethodsFromPayee(values.payee, collective), [values.payee]);
  const onPayoutMethodRemove = React.useCallback(() => refreshPayoutProfile(formik, payoutProfiles), [payoutProfiles]);
  const setPayoutMethod = React.useCallback(({ value }) => formik.setFieldValue('payoutMethod', value), []);

  // When user logs in we set its account as the default payout profile if not yet defined
  React.useEffect(() => {
    if (!values.payee && !isEmpty(payoutProfiles)) {
      formik.setFieldValue('payee', first(payoutProfiles));
    }
  }, [payoutProfiles]);

  // Pre-fill address based on the payout profile
  React.useEffect(() => {
    if (!values.payeeLocation?.address && values.payee?.location) {
      setLocationFromPayee(formik, values.payee);
    }
  }, [values.payee]);

  // Load values from localstorage
  React.useEffect(() => {
    if (shouldLoadValuesFromPersister && formPersister && !dirty) {
      const formValues = formPersister.loadValues();
      if (formValues) {
        // Reset payoutMethod if host is no longer connected to TransferWise
        if (formValues.payoutMethod?.type === PayoutMethodType.BANK_ACCOUNT && !collective.host?.transferwise) {
          formValues.payoutMethod = undefined;
        }
        setValues(formValues);
      }
    }
  }, [formPersister, dirty]);

  // Save values in localstorage
  React.useEffect(() => {
    if (dirty && formPersister) {
      formPersister.saveValues(values);
    }
  }, [formPersister, dirty, values]);

  return (
    <Form>
      <ExpenseTypeRadioSelect
        name="type"
        onChange={handleChange}
        value={values.type}
        options={{
          fundingRequest:
            [CollectiveType.FUND].includes(collective.type) || collective.settings?.fundingRequest === true,
        }}
      />
      {values.type && (
        <Box width="100%">
          <StyledCard mt={4} p={[16, 24, 32]} overflow="initial">
            <HiddenStep show={step == STEPS.PAYEE}>
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
                <Flex justifyContent="space-between" flexWrap="wrap">
                  <Box minWidth={250} flex="1 1 50%">
                    <Field name="payee">
                      {({ field }) => (
                        <StyledInputField
                          name={field.name}
                          label={formatMessage(msg.payeeLabel)}
                          labelFontSize="13px"
                          flex="1"
                          mr={fieldsMarginRight}
                          mt={3}
                        >
                          {({ id }) => (
                            <CollectivePicker
                              inputId={id}
                              collectives={payoutProfiles}
                              getDefaultOptions={build => values.payee && build(values.payee)}
                              data-cy="select-expense-payee"
                              onChange={({ value }) => {
                                formik.setFieldValue('payee', value);
                                formik.setFieldValue('payoutMethod', null);
                                setLocationFromPayee(formik, value);
                              }}
                            />
                          )}
                        </StyledInputField>
                      )}
                    </Field>
                    {values.type === expenseTypes.INVOICE && (
                      <Fragment>
                        <FastField name="payeeLocation.country">
                          {({ field }) => (
                            <StyledInputField
                              name={field.name}
                              label={formatMessage(msg.country)}
                              labelFontSize="13px"
                              error={formatFormErrorMessage(intl, errors.payeeLocation?.country)}
                              required
                              minWidth={250}
                              mr={fieldsMarginRight}
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
                        <FastField name="payeeLocation.address">
                          {({ field }) => (
                            <StyledInputField
                              name={field.name}
                              label={formatMessage(msg.address)}
                              labelFontSize="13px"
                              error={formatFormErrorMessage(intl, errors.payeeLocation?.address)}
                              required
                              minWidth={250}
                              mr={fieldsMarginRight}
                              mt={3}
                            >
                              {inputProps => (
                                <StyledTextarea
                                  {...inputProps}
                                  {...field}
                                  minHeight={100}
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
                              minWidth={250}
                              mr={fieldsMarginRight}
                              mt={3}
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
                      </Fragment>
                    )}
                  </Box>
                  <Box minWidth={250} flex="1 1 50%">
                    <Field name="payoutMethod">
                      {({ field }) => (
                        <StyledInputField
                          name={field.name}
                          htmlFor="payout-method"
                          flex="1"
                          mr={fieldsMarginRight}
                          mt={3}
                          minWidth={250}
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

                    {values.payoutMethod && (
                      <Field name="payoutMethod">
                        {({ field, meta }) => (
                          <Box mr={fieldsMarginRight} mt={3} flex="1" minWidth={258}>
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
                  </Box>
                </Flex>
              </Box>
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
                    data-cy="expense-summary-btn"
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
                  data-cy="expense-summary-btn"
                  buttonStyle="primary"
                  disabled={!stepOneCompleted}
                  onClick={() => setStep(STEPS.EXPENSE)}
                >
                  <FormattedMessage id="Pagination.Next" defaultMessage="Next" />
                  &nbsp;→
                </StyledButton>
              </Flex>
            </HiddenStep>

            <HiddenStep show={step == STEPS.EXPENSE}>
              <Flex alignItems="center" mb={10}>
                <P
                  as="label"
                  htmlFor="expense-description"
                  color="black.900"
                  fontSize="16px"
                  lineHeight="24px"
                  fontWeight="bold"
                >
                  {values.type === expenseTypes.FUNDING_REQUEST ? (
                    <FormattedMessage
                      id="Expense.EnterRequestSubject"
                      defaultMessage="Enter request subject <small>(Public)</small>"
                      values={{
                        small(msg) {
                          return (
                            <Span fontWeight="normal" color="black.600">
                              {msg}
                            </Span>
                          );
                        },
                      }}
                    />
                  ) : (
                    <FormattedMessage
                      id="Expense.EnterExpenseTitle"
                      defaultMessage="Enter expense title <small>(Public)</small>"
                      values={{
                        small(msg) {
                          return (
                            <Span fontWeight="normal" color="black.600">
                              {msg}
                            </Span>
                          );
                        },
                      }}
                    />
                  )}
                </P>
                <StyledHr flex="1" borderColor="black.300" ml={2} />
              </Flex>
              <P fontSize="12px" color="black.600">
                <FormattedMessage
                  id="Expense.PrivacyWarning"
                  defaultMessage="This information is public. Please do not add any personal information such as names or addresses in this field."
                />
              </P>
              <Field
                as={StyledInput}
                autoFocus={autoFocusTitle}
                id="expense-description"
                name="description"
                placeholder={
                  values.type === expenseTypes.FUNDING_REQUEST
                    ? formatMessage(msg.subjectPlaceholder)
                    : formatMessage(msg.descriptionPlaceholder)
                }
                width="100%"
                fontSize="24px"
                border="0"
                error={errors.description}
                mt={3}
                px={2}
                py={1}
                maxLength={255}
                withOutline
              />
              <Fragment>
                {values.type === expenseTypes.FUNDING_REQUEST && (
                  <Fragment>
                    <Flex alignItems="center" mt={20} mb={10}>
                      <P
                        as="label"
                        htmlFor="expense-longDescription"
                        color="black.900"
                        fontSize="16px"
                        lineHeight="24px"
                        fontWeight="bold"
                      >
                        <FormattedMessage
                          id="Expense.EnterExpenseMessage"
                          defaultMessage="Enter a message explaining your request"
                          values={{
                            small(msg) {
                              return (
                                <Span fontWeight="normal" color="black.600">
                                  {msg}
                                </Span>
                              );
                            },
                          }}
                        />
                      </P>
                      <StyledHr flex="1" borderColor="black.300" ml={2} />
                    </Flex>
                    <Field
                      as={StyledTextarea}
                      id="expense-longDescription"
                      name="longDescription"
                      placeholder=""
                      width="100%"
                      height={200}
                      fontSize="P"
                      error={errors.message}
                      mt={3}
                      px={2}
                      py={1}
                      maxLength={1000}
                      withOutline
                      showCount={true}
                    />
                  </Fragment>
                )}
                <Flex alignItems="flex-start" mt={3}>
                  <ExpenseTypeTag type={values.type} mr="4px" />
                  <StyledInputTags
                    renderUpdatedTags
                    suggestedTags={expensesTags}
                    onChange={tags =>
                      formik.setFieldValue(
                        'tags',
                        tags.map(t => t.value.toLowerCase()),
                      )
                    }
                    value={values.tags}
                  />
                </Flex>
                {values.type === expenseTypes.INVOICE && (
                  <Box my={40}>
                    <ExpenseAttachedFilesForm
                      onChange={files => formik.setFieldValue('attachedFiles', files)}
                      defaultValue={values.attachedFiles}
                    />
                  </Box>
                )}

                <Flex alignItems="center" my={24}>
                  <Span color="black.900" fontSize="16px" lineHeight="21px" fontWeight="bold">
                    {formatMessage(
                      isReceipt ? msg.stepReceipt : isFundingRequest ? msg.stepFundingRequest : msg.stepInvoice,
                    )}
                  </Span>
                  <StyledHr flex="1" borderColor="black.300" mx={2} />
                  <StyledButton
                    buttonSize="tiny"
                    type="button"
                    onClick={() => addNewExpenseItem(formik)}
                    minWidth={135}
                    data-cy="expense-add-item-btn"
                  >
                    +&nbsp;{formatMessage(isReceipt ? msg.addNewReceipt : msg.addNewItem)}
                  </StyledButton>
                </Flex>
                <Box>
                  <FieldArray name="items" component={ExpenseFormItems} />
                </Box>
              </Fragment>

              <StyledHr flex="1" mt={4} borderColor="black.300" />

              <Flex mt={3} flexWrap="wrap" alignItems="center">
                <StyledButton
                  type="button"
                  width={['100%', 'auto']}
                  mx={[2, 0]}
                  mr={[null, 3]}
                  mt={2}
                  whiteSpace="nowrap"
                  data-cy="expense-summary-btn"
                  disabled={!stepOneCompleted}
                  onClick={() => setStep(STEPS.PAYEE)}
                >
                  ←&nbsp;
                  <FormattedMessage id="Back" defaultMessage="Back" />
                </StyledButton>
                <StyledButton
                  type="submit"
                  width={['100%', 'auto']}
                  mx={[2, 0]}
                  mr={[null, 3]}
                  mt={2}
                  whiteSpace="nowrap"
                  data-cy="expense-summary-btn"
                  buttonStyle="primary"
                  disabled={!stepTwoCompleted || !formik.isValid}
                  loading={formik.isSubmitting}
                >
                  <FormattedMessage id="Pagination.Next" defaultMessage="Next" />
                  &nbsp;→
                </StyledButton>
                {errors.payoutMethod?.data?.currency && (
                  <Box mx={[2, 0]} mt={2} color="red.500" fontSize="12px" letterSpacing={0}>
                    {errors.payoutMethod.data.currency.toString()}
                  </Box>
                )}
              </Flex>
            </HiddenStep>
          </StyledCard>
        </Box>
      )}

      {step == STEPS.EXPENSE && (
        <StyledCard mt={4} p={[16, 24, 32]} overflow="initial">
          <ExpensePayeeDetails expense={formik.values} host={collective.host} borderless />
        </StyledCard>
      )}
    </Form>
  );
};

ExpenseFormBody.propTypes = {
  formik: PropTypes.object,
  payoutProfiles: PropTypes.array,
  autoFocusTitle: PropTypes.bool,
  shouldLoadValuesFromPersister: PropTypes.bool,
  onCancel: PropTypes.func,
  formPersister: PropTypes.object,
  expensesTags: PropTypes.arrayOf(PropTypes.string),
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

/**
 * Main create expense form
 */
const ExpenseForm = ({
  onSubmit,
  collective,
  expense,
  payoutProfiles,
  autoFocusTitle,
  onCancel,
  validateOnChange,
  formPersister,
  expensesTags,
  shouldLoadValuesFromPersister,
}) => {
  const [hasValidate, setValidate] = React.useState(validateOnChange);

  return (
    <Formik
      initialValues={{ ...getDefaultExpense(collective), ...expense }}
      validate={hasValidate && validate}
      onSubmit={async (values, formik) => {
        // We initially let the browser do the validation. Then once users try to submit the
        // form at least once, we validate on each change to make sure they fix all the errors.
        const errors = validate(values);
        if (!isEmpty(errors)) {
          setValidate(true);
          formik.setErrors(errors);
        } else {
          return onSubmit(values);
        }
      }}
    >
      {formik => (
        <ExpenseFormBody
          formik={formik}
          payoutProfiles={payoutProfiles}
          collective={collective}
          autoFocusTitle={autoFocusTitle}
          onCancel={onCancel}
          formPersister={formPersister}
          expensesTags={expensesTags}
          shouldLoadValuesFromPersister={shouldLoadValuesFromPersister}
        />
      )}
    </Formik>
  );
};

ExpenseForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  autoFocusTitle: PropTypes.bool,
  validateOnChange: PropTypes.bool,
  shouldLoadValuesFromPersister: PropTypes.bool,
  onCancel: PropTypes.func,
  /** To save draft of form values */
  formPersister: PropTypes.object,
  expensesTags: PropTypes.arrayOf(PropTypes.string),
  collective: PropTypes.shape({
    currency: PropTypes.string.isRequired,
    slug: PropTypes.string.isRequired,
    host: PropTypes.shape({
      slug: PropTypes.string.isRequired,
      transferwise: PropTypes.shape({
        availableCurrencies: PropTypes.arrayOf(PropTypes.object),
      }),
    }),
    settings: PropTypes.object,
  }).isRequired,
  /** If editing */
  expense: PropTypes.shape({
    type: PropTypes.oneOf(Object.values(expenseTypes)),
    description: PropTypes.string,
    items: PropTypes.arrayOf(
      PropTypes.shape({
        url: PropTypes.string,
      }),
    ),
  }),
  /** Payout profiles that user has access to */
  payoutProfiles: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      slug: PropTypes.string,
      location: PropTypes.shape({
        address: PropTypes.string,
        country: PropTypes.string,
      }),
      payoutMethods: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string,
          type: PropTypes.oneOf(Object.values(PayoutMethodType)),
          name: PropTypes.string,
          data: PropTypes.object,
        }),
      ),
    }),
  ),
};

ExpenseForm.defaultProps = {
  validateOnChange: false,
};

export default React.memo(ExpenseForm);
