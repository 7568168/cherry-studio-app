import { TrueSheet } from '@lodev09/react-native-true-sheet'
import { Button } from 'heroui-native'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BackHandler, Keyboard, TouchableWithoutFeedback, View, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Text from '@/componentsV2/base/Text'
import TextField from '@/componentsV2/base/TextField'
import XStack from '@/componentsV2/layout/XStack'
import YStack from '@/componentsV2/layout/YStack'
import { useTheme } from '@/hooks/useTheme'
import { fetchModels } from '@/services/ApiService'
import { loggerService } from '@/services/LoggerService'
import type { Model, Provider } from '@/types/assistant'
import { isIOS26 } from '@/utils/device'
import { getDefaultGroupName } from '@/utils/naming'
import { Download } from '@/componentsV2/icons/LucideIcon'

const logger = loggerService.withContext('AddModelSheet')

const SHEET_NAME = 'add-model-sheet'

// Global state for provider and updateProvider
let currentProvider: Provider | undefined
let currentUpdateProvider: ((updates: Partial<Omit<Provider, 'id'>>) => Promise<void>) | undefined
let updateProviderCallback: ((provider: Provider | undefined) => void) | null = null

export const presentAddModelSheet = (
  provider: Provider,
  updateProvider: (updates: Partial<Omit<Provider, 'id'>>) => Promise<void>
) => {
  currentProvider = provider
  currentUpdateProvider = updateProvider
  updateProviderCallback?.(provider)
  return TrueSheet.present(SHEET_NAME)
}

export const dismissAddModelSheet = () => TrueSheet.dismiss(SHEET_NAME)

export const AddModelSheet: React.FC = () => {
  const { t } = useTranslation()
  const { isDark } = useTheme()

  const [provider, setProvider] = useState<Provider | undefined>(currentProvider)
  const [modelId, setModelId] = useState('')
  const [modelName, setModelName] = useState('')
  const [modelGroup, setModelGroup] = useState('')
  const [isVisible, setIsVisible] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [availableModels, setAvailableModels] = useState<Model[]>([])
  const insets = useSafeAreaInsets()

  useEffect(() => {
    updateProviderCallback = setProvider
    return () => {
      updateProviderCallback = null
    }
  }, [])

  useEffect(() => {
    setModelName(modelId)
    setModelGroup(getDefaultGroupName(modelId, provider?.id))
  }, [modelId, provider?.id])

  useEffect(() => {
    if (!isVisible) return

    const backAction = () => {
      dismissAddModelSheet()
      return true
    }

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction)
    return () => backHandler.remove()
  }, [isVisible])

  const resetForm = () => {
    setModelId('')
    setModelName('')
    setModelGroup('')
  }

  const handleFetchModels = async () => {
    if (!provider || isFetching) return
    setIsFetching(true)
    try {
      const modelsFromApi = await fetchModels(provider)
      const transformedModels = modelsFromApi.map(model => ({
        id: model?.id || model?.name,
        name: model?.display_name || model?.displayName || model?.name || model?.id,
        provider: provider.id,
        group: getDefaultGroupName(model?.id || model?.name, provider.id),
        description: model?.description || '',
        owned_by: model?.owned_by || '',
        supported_endpoint_types: model?.supported_endpoint_types
      })).filter(model => model.id && model.name)
      setAvailableModels(transformedModels)
    } catch (error) {
      logger.error('Failed to fetch models:', error)
      setAvailableModels([])
    } finally {
      setIsFetching(false)
    }
  }

  const handleSelectModel = (model: Model) => {
    setModelId(model.id)
    setModelName(model.name)
    setModelGroup(model.group)
  }

  const handleAddModel = async () => {
    if (!provider || !currentUpdateProvider || !modelId.trim()) {
      logger.warn('Provider not available or Model ID is required.')
      return
    }

    if (provider.models.some(model => model.id === modelId.trim())) {
      logger.warn('Model ID already exists.', { modelId: modelId.trim() })
      return
    }

    const newModel: Model = {
      id: modelId,
      provider: provider.id,
      name: modelName,
      group: modelGroup
    }

    try {
      await currentUpdateProvider({ models: [...provider.models, newModel] })
      logger.info('Successfully added model:', newModel)
      dismissAddModelSheet()
    } catch (error) {
      logger.error('Failed to add model:', error)
    } finally {
      resetForm()
    }
  }

  const header = (
    <XStack className="w-full items-center justify-center pb-2 pt-5">
      <Text className="text-foreground text-xl">{t('settings.models.add.model.label')}</Text>
    </XStack>
  )

  return (
    <TrueSheet
      name={SHEET_NAME}
      detents={['auto']}
      cornerRadius={30}
      grabber
      dismissible
      dimmed
      backgroundColor={isIOS26 ? undefined : isDark ? '#19191c' : '#ffffff'}
      header={header}
      onDidDismiss={() => {
        setIsVisible(false)
        resetForm()
      }}
      onDidPresent={() => setIsVisible(true)}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ paddingBottom: insets.bottom }}>
          <YStack className="items-center gap-6 px-5 pb-7">
            {/* Fetch Models Button */}
            <Button
              pressableFeedbackVariant="ripple"
              variant="secondary"
              className="h-11 w-full rounded-2xl"
              onPress={handleFetchModels}
              isDisabled={!provider || isFetching}>
              <Button.Label>
                <XStack className="items-center gap-2">
                  {isFetching ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Download size={16} color="#ffffff" />
                  )}
                  <Text className="text-white">{t('models.fetch_list') || 'Fetch Model List'}</Text>
                </XStack>
              </Button.Label>
            </Button>

            {/* Available Models List */}
            {availableModels.length > 0 && (
              <YStack className="w-full gap-2 max-h-48 overflow-y-auto">
                <Text className="text-foreground-secondary text-sm px-3">Available Models:</Text>
                <View className="w-full border rounded-2xl overflow-hidden">
                  {availableModels.map((model) => (
                    <View
                      key={model.id}
                      className="px-4 py-2 border-b last:border-b-0"
                      style={{ backgroundColor: modelId === model.id ? '#e0e7ff' : 'transparent' }}
                    >
                      <TouchableWithoutFeedback onPress={() => handleSelectModel(model)}>
                        <YStack className="gap-1">
                          <Text className="text-sm font-medium">{model.name}</Text>
                          <Text className="text-xs text-foreground-secondary">{model.id}</Text>
                        </YStack>
                      </TouchableWithoutFeedback>
                    </View>
                  ))}
                </View>
              </YStack>
            )}

            {/* Model ID Input */}
            <YStack className="w-full gap-2">
              <XStack className="gap-2 px-3">
                <Text className="text-foreground-secondary">{t('settings.models.add.model.id.label')}</Text>
                <Text className="text-red-500">*</Text>
              </XStack>
              <TextField className="rounded-2xl">
                <TextField.Input
                  className="h-11"
                  placeholder={t('settings.models.add.model.id.placeholder')}
                  value={modelId}
                  onChangeText={setModelId}
                />
              </TextField>
            </YStack>

            {/* Model Name Input */}
            <YStack className="w-full gap-2">
              <XStack className="gap-2 px-3">
                <Text className="text-foreground-secondary">{t('settings.models.add.model.name.label')}</Text>
              </XStack>
              <TextField className="rounded-2xl">
                <TextField.Input
                  className="h-11"
                  placeholder={t('settings.models.add.model.name.placeholder')}
                  value={modelName}
                  onChangeText={setModelName}
                />
              </TextField>
            </YStack>

            {/* Model Group Input */}
            <YStack className="w-full gap-2">
              <XStack className="gap-2 px-3">
                <Text className="text-foreground-secondary">{t('settings.models.add.model.group.label')}</Text>
              </XStack>
              <TextField className="rounded-2xl">
                <TextField.Input
                  className="h-11"
                  placeholder={t('settings.models.add.model.group.placeholder')}
                  value={modelGroup}
                  onChangeText={setModelGroup}
                />
              </TextField>
            </YStack>

            <Button
              pressableFeedbackVariant="ripple"
              variant="tertiary"
              className="primary-container h-11 w-4/6 rounded-2xl"
              onPress={handleAddModel}
              isDisabled={!modelId.trim()}>
              <Button.Label>
                <Text className="primary-text">{t('settings.models.add.model.label')}</Text>
              </Button.Label>
            </Button>
          </YStack>
        </View>
      </TouchableWithoutFeedback>
    </TrueSheet>
  )
}

AddModelSheet.displayName = 'AddModelSheet'
