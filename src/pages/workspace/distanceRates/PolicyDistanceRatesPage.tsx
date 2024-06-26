import type {StackScreenProps} from '@react-navigation/stack';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import {withOnyx} from 'react-native-onyx';
import Button from '@components/Button';
import type {DropdownOption, WorkspaceDistanceRatesBulkActionType} from '@components/ButtonWithDropdownMenu/types';
import ConfirmModal from '@components/ConfirmModal';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import Icon from '@components/Icon';
import * as Expensicons from '@components/Icon/Expensicons';
import * as Illustrations from '@components/Icon/Illustrations';
import ScreenWrapper from '@components/ScreenWrapper';
import SelectionList from '@components/SelectionList';
import TableListItem from '@components/SelectionList/TableListItem';
import type {ListItem} from '@components/SelectionList/types';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import * as CurrencyUtils from '@libs/CurrencyUtils';
import Navigation from '@libs/Navigation/Navigation';
import type {WorkspacesCentralPaneNavigatorParamList} from '@navigation/types';
import AdminPolicyAccessOrNotFoundWrapper from '@pages/workspace/AdminPolicyAccessOrNotFoundWrapper';
import FeatureEnabledAccessOrNotFoundWrapper from '@pages/workspace/FeatureEnabledAccessOrNotFoundWrapper';
import PaidPolicyAccessOrNotFoundWrapper from '@pages/workspace/PaidPolicyAccessOrNotFoundWrapper';
import * as Policy from '@userActions/Policy';
import ButtonWithDropdownMenu from '@src/components/ButtonWithDropdownMenu';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type SCREENS from '@src/SCREENS';
import type * as OnyxTypes from '@src/types/onyx';
import type {CustomUnit, Rate} from '@src/types/onyx/Policy';

type RateForList = ListItem & {value: string};

type PolicyDistanceRatesPageOnyxProps = {
    /** Policy details */
    policy: OnyxEntry<OnyxTypes.Policy>;
};

type PolicyDistanceRatesPageProps = PolicyDistanceRatesPageOnyxProps & StackScreenProps<WorkspacesCentralPaneNavigatorParamList, typeof SCREENS.WORKSPACE.DISTANCE_RATES>;

function PolicyDistanceRatesPage({policy, route}: PolicyDistanceRatesPageProps) {
    const {isSmallScreenWidth} = useWindowDimensions();
    const styles = useThemeStyles();
    const theme = useTheme();
    const {translate} = useLocalize();
    const [selectedDistanceRates, setSelectedDistanceRates] = useState<Rate[]>([]);
    const [isWarningModalVisible, setIsWarningModalVisible] = useState(false);
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
    const dropdownButtonRef = useRef(null);
    const policyID = route.params.policyID;

    const customUnit: CustomUnit | undefined = useMemo(
        () => (policy?.customUnits !== undefined ? policy?.customUnits[Object.keys(policy?.customUnits)[0]] : undefined),
        [policy?.customUnits],
    );
    const customUnitRates: Record<string, Rate> = useMemo(() => customUnit?.rates ?? {}, [customUnit]);
    // Filter out rates that will be deleted
    const allSelectableRates = useMemo(() => Object.values(customUnitRates).filter((rate) => rate.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE), [customUnitRates]);
    const canDisableOrDeleteSelectedRates = useMemo(
        () => allSelectableRates.filter((rate: Rate) => !selectedDistanceRates.some((selectedRate) => selectedRate.customUnitRateID === rate.customUnitRateID)).some((rate) => rate.enabled),
        [allSelectableRates, selectedDistanceRates],
    );

    function fetchDistanceRates() {
        Policy.openPolicyDistanceRatesPage(policyID);
    }

    const dismissError = useCallback(
        (item: RateForList) => {
            if (customUnitRates[item.value].errors) {
                Policy.clearDeleteDistanceRateError(policyID, customUnit?.customUnitID ?? '', item.value);
                return;
            }

            Policy.clearCreateDistanceRateItemAndError(policyID, customUnit?.customUnitID ?? '', item.value);
        },
        [customUnit?.customUnitID, customUnitRates, policyID],
    );

    const {isOffline} = useNetwork({onReconnect: fetchDistanceRates});

    useEffect(() => {
        fetchDistanceRates();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const distanceRatesList = useMemo<RateForList[]>(
        () =>
            Object.values(customUnitRates).map((value) => ({
                value: value.customUnitRateID ?? '',
                text: `${CurrencyUtils.convertAmountToDisplayString(value.rate, value.currency ?? CONST.CURRENCY.USD)} / ${translate(
                    `common.${customUnit?.attributes?.unit ?? CONST.CUSTOM_UNITS.DISTANCE_UNIT_MILES}`,
                )}`,
                keyForList: value.customUnitRateID ?? '',
                isSelected: selectedDistanceRates.find((rate) => rate.customUnitRateID === value.customUnitRateID) !== undefined,
                isDisabled: value.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE,
                pendingAction: value.pendingAction ?? value.pendingFields?.rate ?? value.pendingFields?.enabled ?? value.pendingFields?.currency,
                errors: value.errors ?? undefined,
                rightElement: (
                    <View style={styles.flexRow}>
                        <Text style={[styles.alignSelfCenter, !value.enabled && styles.textSupporting]}>
                            {value.enabled ? translate('workspace.distanceRates.enabled') : translate('workspace.distanceRates.disabled')}
                        </Text>
                        <View style={[styles.p1, styles.pl2]}>
                            <Icon
                                src={Expensicons.ArrowRight}
                                fill={theme.icon}
                            />
                        </View>
                    </View>
                ),
            })),
        [customUnit?.attributes?.unit, customUnitRates, selectedDistanceRates, styles.alignSelfCenter, styles.flexRow, styles.p1, styles.pl2, styles.textSupporting, theme.icon, translate],
    );

    const addRate = () => {
        Navigation.navigate(ROUTES.WORKSPACE_CREATE_DISTANCE_RATE.getRoute(policyID));
    };

    const openSettings = () => {
        Navigation.navigate(ROUTES.WORKSPACE_DISTANCE_RATES_SETTINGS.getRoute(policyID));
    };

    const openRateDetails = (rate: RateForList) => {
        setSelectedDistanceRates([]);
        Navigation.navigate(ROUTES.WORKSPACE_DISTANCE_RATE_DETAILS.getRoute(policyID, rate.value));
    };

    const disableRates = () => {
        if (customUnit === undefined) {
            return;
        }

        Policy.setPolicyDistanceRatesEnabled(
            policyID,
            customUnit,
            selectedDistanceRates.filter((rate) => rate.enabled).map((rate) => ({...rate, enabled: false})),
        );
        setSelectedDistanceRates([]);
    };

    const enableRates = () => {
        if (customUnit === undefined) {
            return;
        }

        Policy.setPolicyDistanceRatesEnabled(
            policyID,
            customUnit,
            selectedDistanceRates.filter((rate) => !rate.enabled).map((rate) => ({...rate, enabled: true})),
        );
        setSelectedDistanceRates([]);
    };

    const deleteRates = () => {
        if (customUnit === undefined) {
            return;
        }

        Policy.deletePolicyDistanceRates(
            policyID,
            customUnit,
            selectedDistanceRates.map((rate) => rate.customUnitRateID ?? ''),
        );
        setSelectedDistanceRates([]);
        setIsDeleteModalVisible(false);
    };

    const toggleRate = (rate: RateForList) => {
        if (selectedDistanceRates.find((selectedRate) => selectedRate.customUnitRateID === rate.value) !== undefined) {
            setSelectedDistanceRates((prev) => prev.filter((selectedRate) => selectedRate.customUnitRateID !== rate.value));
        } else {
            setSelectedDistanceRates((prev) => [...prev, customUnitRates[rate.value]]);
        }
    };

    const toggleAllRates = () => {
        if (selectedDistanceRates.length === allSelectableRates.length) {
            setSelectedDistanceRates([]);
        } else {
            setSelectedDistanceRates([...allSelectableRates]);
        }
    };

    const getCustomListHeader = () => (
        <View style={[styles.flex1, styles.flexRow, styles.justifyContentBetween, styles.pl3, styles.pr9]}>
            <Text style={styles.searchInputStyle}>{translate('workspace.distanceRates.rate')}</Text>
            <Text style={[styles.searchInputStyle, styles.textAlignCenter]}>{translate('statusPage.status')}</Text>
        </View>
    );

    const getBulkActionsButtonOptions = () => {
        const options: Array<DropdownOption<WorkspaceDistanceRatesBulkActionType>> = [
            {
                text: translate('workspace.distanceRates.deleteRates', {count: selectedDistanceRates.length}),
                value: CONST.POLICY.DISTANCE_RATES_BULK_ACTION_TYPES.DELETE,
                icon: Expensicons.Trashcan,
                onSelected: () => (canDisableOrDeleteSelectedRates ? setIsDeleteModalVisible(true) : setIsWarningModalVisible(true)),
            },
        ];

        const enabledRates = selectedDistanceRates.filter((rate) => rate.enabled);
        if (enabledRates.length > 0) {
            options.push({
                text: translate('workspace.distanceRates.disableRates', {count: enabledRates.length}),
                value: CONST.POLICY.DISTANCE_RATES_BULK_ACTION_TYPES.DISABLE,
                icon: Expensicons.DocumentSlash,
                onSelected: () => (canDisableOrDeleteSelectedRates ? disableRates() : setIsWarningModalVisible(true)),
            });
        }

        const disabledRates = selectedDistanceRates.filter((rate) => !rate.enabled);
        if (disabledRates.length > 0) {
            options.push({
                text: translate('workspace.distanceRates.enableRates', {count: disabledRates.length}),
                value: CONST.POLICY.DISTANCE_RATES_BULK_ACTION_TYPES.ENABLE,
                icon: Expensicons.Document,
                onSelected: enableRates,
            });
        }

        return options;
    };

    const isLoading = !isOffline && customUnit === undefined;

    const headerButtons = (
        <View style={[styles.w100, styles.flexRow, isSmallScreenWidth && styles.mb3]}>
            {selectedDistanceRates.length === 0 ? (
                <>
                    <Button
                        medium
                        text={translate('workspace.distanceRates.addRate')}
                        onPress={addRate}
                        style={[styles.mr3, isSmallScreenWidth && styles.flexGrow1]}
                        icon={Expensicons.Plus}
                        success
                    />

                    <Button
                        medium
                        text={translate('workspace.common.settings')}
                        onPress={openSettings}
                        style={[isSmallScreenWidth && styles.flexGrow1]}
                        icon={Expensicons.Gear}
                    />
                </>
            ) : (
                <ButtonWithDropdownMenu<WorkspaceDistanceRatesBulkActionType>
                    shouldAlwaysShowDropdownMenu
                    pressOnEnter
                    customText={translate('workspace.common.selected', {selectedNumber: selectedDistanceRates.length})}
                    buttonSize={CONST.DROPDOWN_BUTTON_SIZE.MEDIUM}
                    onPress={() => null}
                    options={getBulkActionsButtonOptions()}
                    buttonRef={dropdownButtonRef}
                    style={[isSmallScreenWidth && styles.flexGrow1]}
                    wrapperStyle={styles.w100}
                />
            )}
        </View>
    );

    return (
        <AdminPolicyAccessOrNotFoundWrapper policyID={policyID}>
            <PaidPolicyAccessOrNotFoundWrapper policyID={policyID}>
                <FeatureEnabledAccessOrNotFoundWrapper
                    policyID={policyID}
                    featureName={CONST.POLICY.MORE_FEATURES.ARE_DISTANCE_RATES_ENABLED}
                >
                    <ScreenWrapper
                        includeSafeAreaPaddingBottom={false}
                        style={[styles.defaultModalContainer]}
                        testID={PolicyDistanceRatesPage.displayName}
                        shouldShowOfflineIndicatorInWideScreen
                    >
                        <HeaderWithBackButton
                            icon={Illustrations.CarIce}
                            title={translate('workspace.common.distanceRates')}
                            shouldShowBackButton={isSmallScreenWidth}
                        >
                            {!isSmallScreenWidth && headerButtons}
                        </HeaderWithBackButton>
                        {isSmallScreenWidth && <View style={[styles.ph5]}>{headerButtons}</View>}
                        <View style={[styles.ph5, styles.pb5, styles.pt3]}>
                            <Text style={[styles.textNormal, styles.colorMuted]}>{translate('workspace.distanceRates.centrallyManage')}</Text>
                        </View>
                        {isLoading && (
                            <ActivityIndicator
                                size={CONST.ACTIVITY_INDICATOR_SIZE.LARGE}
                                style={[styles.flex1]}
                                color={theme.spinner}
                            />
                        )}
                        {Object.values(customUnitRates).length > 0 && (
                            <SelectionList
                                canSelectMultiple
                                sections={[{data: distanceRatesList, indexOffset: 0, isDisabled: false}]}
                                onCheckboxPress={toggleRate}
                                onSelectRow={openRateDetails}
                                onSelectAll={toggleAllRates}
                                onDismissError={dismissError}
                                showScrollIndicator
                                ListItem={TableListItem}
                                customListHeader={getCustomListHeader()}
                                listHeaderWrapperStyle={[styles.ph9, styles.pv3, styles.pb5]}
                            />
                        )}
                        <ConfirmModal
                            onConfirm={() => setIsWarningModalVisible(false)}
                            isVisible={isWarningModalVisible}
                            title={translate('workspace.distanceRates.oopsNotSoFast')}
                            prompt={translate('workspace.distanceRates.workspaceNeeds')}
                            confirmText={translate('common.buttonConfirm')}
                            shouldShowCancelButton={false}
                        />
                        <ConfirmModal
                            title={translate('workspace.distanceRates.deleteDistanceRate')}
                            isVisible={isDeleteModalVisible}
                            onConfirm={deleteRates}
                            onCancel={() => setIsDeleteModalVisible(false)}
                            prompt={translate('workspace.distanceRates.areYouSureDelete', {count: selectedDistanceRates.length})}
                            confirmText={translate('common.delete')}
                            cancelText={translate('common.cancel')}
                            danger
                        />
                    </ScreenWrapper>
                </FeatureEnabledAccessOrNotFoundWrapper>
            </PaidPolicyAccessOrNotFoundWrapper>
        </AdminPolicyAccessOrNotFoundWrapper>
    );
}

PolicyDistanceRatesPage.displayName = 'PolicyDistanceRatesPage';

export default withOnyx<PolicyDistanceRatesPageProps, PolicyDistanceRatesPageOnyxProps>({
    policy: {
        key: ({route}) => `${ONYXKEYS.COLLECTION.POLICY}${route.params.policyID}`,
    },
})(PolicyDistanceRatesPage);
