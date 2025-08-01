import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Cpu, 
  Zap, 
  Monitor, 
  BarChart3, 
  Save, 
  RefreshCw, 
  Code, 
  Eye, 
  EyeOff, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle, 
  CheckCircle, 
  Play, 
  Info,
  Wrench,
  Gauge,
  Download,
  Upload,
  Database
} from 'lucide-react';

interface Backend {
  id: string;
  name: string;
  description: string;
  folder: string;
  requiresGPU: boolean;
  gpuType: string;
  isAvailable: boolean;
  binaryPath?: string;
}

interface BackendOverride {
  backendId: string | null;
  isOverridden: boolean;
  timestamp?: string;
}

interface ModelConfig {
  name: string;
  path: string;
  port: number;
  isEmbedding: boolean;
  nativeContextSize?: number;
  configuredContextSize?: number;
  gpuLayers?: number;
  batchSize?: number;
  ubatchSize?: number;
  threads?: number;
  flashAttention?: boolean;
  memoryLock?: boolean;
  ttl?: number;
  status: 'available' | 'running' | 'error';
}

interface ConfigurationInfo {
  availableBackends: Backend[];
  currentBackendOverride: BackendOverride | null;
  configuration: any;
  configPath: string;
  performanceSettings: any;
  platform: string;
  architecture: string;
  serviceStatus: {
    isRunning: boolean;
    port: number;
    pid?: number;
  };
  models?: ModelConfig[];
}

const BackendConfigurationPanel: React.FC = () => {
  const [configInfo, setConfigInfo] = useState<ConfigurationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBackend, setSelectedBackend] = useState<string>('auto');
  const [actualBackend, setActualBackend] = useState<string>(''); // The backend actually being used
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [jsonConfig, setJsonConfig] = useState<string>('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({
    backends: true,
    models: true,
    configuration: false,
    advanced: false
  });
  const [operationStatus, setOperationStatus] = useState<{
    type: 'idle' | 'saving' | 'restarting' | 'reconfiguring' | 'success' | 'error';
    message: string;
  }>({ type: 'idle', message: '' });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load configuration information
  const loadConfigurationInfo = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const llamaSwap = (window as any).llamaSwap;
      if (!llamaSwap) {
        throw new Error('LlamaSwap service not available');
      }

      const result = await llamaSwap.getConfigurationInfo();
      if (result.success) {
        setConfigInfo(result);
        setSelectedBackend(result.currentBackendOverride?.backendId || 'auto');
        
        // Extract actual backend from service status
        if (result.serviceStatus && result.serviceStatus.currentBackendName) {
          setActualBackend(result.serviceStatus.currentBackendName);
        }
        
        // Load JSON configuration
        if (result.configuration) {
          setJsonConfig(JSON.stringify(result.configuration, null, 2));
        }
        
        // Load model configurations with metadata
        await loadModelConfigurations();
      } else {
        throw new Error(result.error || 'Failed to load configuration');
      }
    } catch (err) {
      console.error('Error loading configuration:', err);
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  // Load model configurations with native context sizes
  const loadModelConfigurations = async () => {
    try {
      const llamaSwap = (window as any).llamaSwap;
      if (!llamaSwap?.getModelConfigurations) {
        console.warn('getModelConfigurations not available');
        return;
      }

      const result = await llamaSwap.getModelConfigurations();
      if (result.success && result.models) {
        setModelConfigs(result.models);
      }
    } catch (error) {
      console.error('Error loading model configurations:', error);
    }
  };

  useEffect(() => {
    loadConfigurationInfo();
  }, []);

  // Helper to check if operations are in progress
  const isOperationInProgress = operationStatus.type === 'saving' || operationStatus.type === 'restarting' || operationStatus.type === 'reconfiguring';

  // Handle backend selection change
  const handleBackendChange = async (backendId: string) => {
    setOperationStatus({ type: 'saving', message: 'Updating backend selection...' });
    
    try {
      const llamaSwap = (window as any).llamaSwap;
      const result = await llamaSwap.setBackendOverride(backendId === 'auto' ? null : backendId);
      
      if (result.success) {
        setSelectedBackend(backendId);
        setOperationStatus({ type: 'restarting', message: 'Stopping service...' });
        
        // Update status messages during restart process
        setTimeout(() => {
          setOperationStatus({ type: 'restarting', message: 'Applying backend changes...' });
        }, 1000);
        
        setTimeout(() => {
          setOperationStatus({ type: 'restarting', message: `Starting service with ${backendId === 'auto' ? 'auto-detect' : backendId} backend...` });
        }, 3000);
        
        setTimeout(() => {
          setOperationStatus({ type: 'restarting', message: 'Initializing service... (this may take a moment)' });
        }, 5000);
        
        setTimeout(() => {
          setOperationStatus({ type: 'restarting', message: 'Service startup in progress... (almost ready)' });
        }, 10000);
        
        // Automatically restart the service with the new backend
        const restartResult = await llamaSwap.restartWithOverrides();
        if (restartResult.success) {
          setOperationStatus({ 
            type: 'success', 
            message: `✅ Backend changed to ${backendId === 'auto' ? 'Auto-detect' : backendId} and service restarted!` 
          });
          
          // Reload configuration info to show updated paths and service status
          await loadConfigurationInfo();
          
          setTimeout(() => {
            setOperationStatus({ type: 'idle', message: '' });
          }, 3000);
        } else {
          throw new Error(restartResult.error || 'Failed to restart service with new backend');
        }
      } else {
        throw new Error(result.error || 'Failed to set backend');
      }
    } catch (error) {
      console.error('Error changing backend:', error);
      setOperationStatus({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to change backend' 
      });
      setTimeout(() => {
        setOperationStatus({ type: 'idle', message: '' });
      }, 5000);
    } finally {
    }
  };

  // Force reconfigure
  const handleReconfigure = async () => {
    setOperationStatus({ type: 'reconfiguring', message: 'Regenerating configuration...' });
    
    try {
      const llamaSwap = (window as any).llamaSwap;
      const result = await llamaSwap.regenerateConfig();
      
      if (result.success) {
        setOperationStatus({ 
          type: 'success', 
          message: `Configuration regenerated with ${result.models} models` 
        });
        
        // Reload configuration info
        await loadConfigurationInfo();
        
        setTimeout(() => {
          setOperationStatus({ type: 'idle', message: '' });
        }, 2000);
      } else {
        throw new Error(result.error || 'Failed to reconfigure');
      }
    } catch (error) {
      console.error('Error reconfiguring:', error);
      setOperationStatus({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to reconfigure' 
      });
      setTimeout(() => {
        setOperationStatus({ type: 'idle', message: '' });
      }, 3000);
    }
  };

  // Restart with overrides
  const handleRestartWithOverrides = async () => {
    setOperationStatus({ type: 'restarting', message: 'Stopping service...' });
    
    try {
      const llamaSwap = (window as any).llamaSwap;
      
      // Update status messages during restart process
      setTimeout(() => {
        setOperationStatus({ type: 'restarting', message: 'Applying configuration...' });
      }, 1000);
      
      setTimeout(() => {
        setOperationStatus({ type: 'restarting', message: 'Starting service with new settings...' });
      }, 3000);
      
      const result = await llamaSwap.restartWithOverrides();
      
      if (result.success) {
        setOperationStatus({ type: 'success', message: 'Service restarted successfully!' });
        
        // Reload configuration info
        await loadConfigurationInfo();
        
        setTimeout(() => {
          setOperationStatus({ type: 'idle', message: '' });
        }, 2000);
      } else {
        throw new Error(result.error || 'Failed to restart service');
      }
    } catch (error) {
      console.error('Error restarting service:', error);
      setOperationStatus({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to restart service' 
      });
      setTimeout(() => {
        setOperationStatus({ type: 'idle', message: '' });
      }, 3000);
    } finally {
    }
  };

  // Validate and update JSON configuration
  const handleJsonChange = (value: string) => {
    setJsonConfig(value);
    
    // Check if configuration has changed
    const originalConfig = configInfo?.configuration ? JSON.stringify(configInfo.configuration, null, 2) : '';
    setHasUnsavedChanges(value !== originalConfig);
    
    try {
      JSON.parse(value);
      setJsonError(null);
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : 'Invalid JSON');
    }
  };

  // Save YAML configuration from JSON
  const saveConfiguration = async () => {
    if (jsonError) {
      setOperationStatus({ 
        type: 'error', 
        message: 'Cannot save configuration with JSON errors' 
      });
      return;
    }

    setOperationStatus({ type: 'saving', message: 'Saving configuration...' });
    
    try {
      const llamaSwap = (window as any).llamaSwap;
      const result = await llamaSwap.saveConfigFromJson(jsonConfig);
      
      if (result.success) {
        let message = '✅ Configuration saved successfully!';
        
        // Show restart recommendation if needed
        if (result.requiresRestart?.required) {
          message += ` ⚠️ ${result.requiresRestart.recommendation}`;
        }
        
        setOperationStatus({ 
          type: 'success', 
          message 
        });
        setHasUnsavedChanges(false);
        
        // Reload configuration info to reflect changes
        await loadConfigurationInfo();
        
        setTimeout(() => {
          setOperationStatus({ type: 'idle', message: '' });
        }, result.requiresRestart?.required ? 5000 : 2000); // Show longer if restart needed
      } else {
        throw new Error(result.error || 'Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving configuration:', error);
      setOperationStatus({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to save configuration' 
      });
      setTimeout(() => {
        setOperationStatus({ type: 'idle', message: '' });
      }, 5000);
    }
  };

  // Save configuration and restart service
  const saveConfigurationAndRestart = async () => {
    if (jsonError) {
      setOperationStatus({ 
        type: 'error', 
        message: 'Cannot save configuration with JSON errors' 
      });
      return;
    }

    setOperationStatus({ type: 'saving', message: 'Saving configuration...' });
    
    try {
      const llamaSwap = (window as any).llamaSwap;
      
      // Update status messages during the process
      setTimeout(() => {
        setOperationStatus({ type: 'restarting', message: 'Configuration saved, restarting service...' });
      }, 1000);
      
      setTimeout(() => {
        setOperationStatus({ type: 'restarting', message: 'Applying new configuration...' });
      }, 3000);
      
      const result = await llamaSwap.saveConfigAndRestart(jsonConfig);
      
      if (result.success) {
        setOperationStatus({ 
          type: 'success', 
          message: '✅ Configuration saved and service restarted successfully!' 
        });
        setHasUnsavedChanges(false);
        
        // Reload configuration info to reflect changes
        await loadConfigurationInfo();
        
        setTimeout(() => {
          setOperationStatus({ type: 'idle', message: '' });
        }, 3000);
      } else {
        throw new Error(result.error || 'Failed to save configuration and restart');
      }
    } catch (error) {
      console.error('Error saving configuration and restarting:', error);
      setOperationStatus({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to save configuration and restart' 
      });
      setTimeout(() => {
        setOperationStatus({ type: 'idle', message: '' });
      }, 5000);
    } finally {
    }
  };

  // Export configuration
  const exportConfiguration = () => {
    if (!configInfo?.configuration) return;
    
    const dataStr = JSON.stringify(configInfo.configuration, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'llama-swap-config.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Import configuration
  const importConfiguration = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        JSON.parse(content); // Validate JSON
        setJsonConfig(content);
        setJsonError(null);
      } catch (error) {
        setJsonError('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Handle model configuration changes
  const updateModelConfig = (modelName: string, field: keyof ModelConfig, value: any) => {
    setModelConfigs(prev => prev.map(model => 
      model.name === modelName 
        ? { ...model, [field]: value }
        : model
    ));
    setHasUnsavedChanges(true);
  };

  // Save individual model configuration
  const saveModelConfiguration = async (modelName: string) => {
    setOperationStatus({ type: 'saving', message: `Saving configuration for ${modelName}...` });
    
    try {
      const modelConfig = modelConfigs.find(m => m.name === modelName);
      if (!modelConfig) {
        throw new Error('Model configuration not found');
      }

      const llamaSwap = (window as any).llamaSwap;
      const result = await llamaSwap.saveModelConfiguration(modelName, modelConfig);
      
      if (result.success) {
        setOperationStatus({ 
          type: 'success', 
          message: `✅ Configuration saved for ${modelName}` 
        });
        setHasUnsavedChanges(false);
        
        setTimeout(() => {
          setOperationStatus({ type: 'idle', message: '' });
        }, 2000);
      } else {
        throw new Error(result.error || 'Failed to save model configuration');
      }
    } catch (error) {
      console.error('Error saving model configuration:', error);
      setOperationStatus({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to save model configuration' 
      });
      setTimeout(() => {
        setOperationStatus({ type: 'idle', message: '' });
      }, 3000);
    }
  };

  // Save all model configurations
  const saveAllModelConfigurations = async () => {
    setOperationStatus({ type: 'saving', message: 'Saving all model configurations...' });
    
    try {
      const llamaSwap = (window as any).llamaSwap;
      const result = await llamaSwap.saveAllModelConfigurations(modelConfigs);
      
      if (result.success) {
        setOperationStatus({ 
          type: 'success', 
          message: `✅ All model configurations saved successfully!` 
        });
        setHasUnsavedChanges(false);
        
        setTimeout(() => {
          setOperationStatus({ type: 'idle', message: '' });
        }, 2000);
      } else {
        throw new Error(result.error || 'Failed to save model configurations');
      }
    } catch (error) {
      console.error('Error saving model configurations:', error);
      setOperationStatus({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to save model configurations' 
      });
      setTimeout(() => {
        setOperationStatus({ type: 'idle', message: '' });
      }, 3000);
    }
  };

  // Get backend icon
  const getBackendIcon = (backend: Backend) => {
    switch (backend.gpuType) {
      case 'nvidia':
        return <Zap className="w-5 h-5 text-green-500" />;
      case 'amd':
        return <BarChart3 className="w-5 h-5 text-red-500" />;
      case 'apple':
        return <Monitor className="w-5 h-5 text-blue-500" />;
      case 'any':
        return <Gauge className="w-5 h-5 text-purple-500" />;
      case 'none':
        return <Cpu className="w-5 h-5 text-gray-500" />;
      default:
        return <Settings className="w-5 h-5 text-gray-400" />;
    }
  };

  // Get status color and icon
  const getStatusDisplay = () => {
    switch (operationStatus.type) {
      case 'saving':
      case 'reconfiguring':
      case 'restarting':
        return {
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          icon: <RefreshCw className="w-4 h-4 animate-spin" />
        };
      case 'success':
        return {
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          icon: <CheckCircle className="w-4 h-4" />
        };
      case 'error':
        return {
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          icon: <AlertTriangle className="w-4 h-4" />
        };
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Loading Configuration</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Fetching backend and configuration data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-700 rounded-xl p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Configuration Error</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{error}</p>
            <button
              onClick={loadConfigurationInfo}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wrench className="w-6 h-6 text-blue-500" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Backend Configuration Studio
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Advanced backend selection and configuration management
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              configInfo?.serviceStatus.isRunning
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
            }`}>
              {configInfo?.serviceStatus.isRunning ? 'Running' : 'Stopped'}
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      {operationStatus.type !== 'idle' && (
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className={`flex items-center gap-2 p-3 rounded-lg ${getStatusDisplay()?.bgColor}`}>
            {getStatusDisplay()?.icon}
            <span className={`text-sm font-medium ${getStatusDisplay()?.color}`}>
              {operationStatus.message}
            </span>
          </div>
        </div>
      )}

      <div className="p-6 space-y-6">
        {/* Backend Selection Section */}
        <div className="space-y-4">
          <button
            onClick={() => toggleSection('backends')}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Backend Selection</h4>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                ({configInfo?.availableBackends.filter(b => b.isAvailable).length} available)
              </span>
            </div>
            {expandedSections.backends ? 
              <ChevronUp className="w-5 h-5 text-gray-400" /> : 
              <ChevronDown className="w-5 h-5 text-gray-400" />
            }
          </button>

          {expandedSections.backends && (
            <div className="space-y-4">
              {/* Current Selection Display */}
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Backend:</span>
                  <div className="flex items-center gap-2">
                    {selectedBackend === 'auto' ? (
                      <Settings className="w-4 h-4 text-blue-500" />
                    ) : (
                      getBackendIcon(configInfo?.availableBackends.find(b => b.id === selectedBackend) || {} as Backend)
                    )}
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {selectedBackend === 'auto' 
                        ? (actualBackend ? `Auto-detect (${actualBackend})` : 'Auto-detect')
                        : configInfo?.availableBackends.find(b => b.id === selectedBackend)?.name || selectedBackend}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Platform: {configInfo?.platform} ({configInfo?.architecture})
                </p>
              </div>

              {/* Backend Options Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Auto-detect Option */}
                <button
                  onClick={() => handleBackendChange('auto')}
                  disabled={isOperationInProgress}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    selectedBackend === 'auto'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Settings className="w-5 h-5 text-blue-500" />
                    <span className="font-semibold text-gray-900 dark:text-white">Auto-detect</span>
                    {selectedBackend === 'auto' && <CheckCircle className="w-4 h-4 text-blue-500 ml-auto" />}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Automatically detect and use the best available backend
                  </p>
                </button>

                {/* Available Backends */}
                {configInfo?.availableBackends
                  .filter(backend => backend.isAvailable && backend.id !== 'auto') // Exclude 'auto' from backend list
                  .map((backend) => (
                    <button
                      key={backend.id}
                      onClick={() => handleBackendChange(backend.id)}
                      disabled={isOperationInProgress}
                      className={`p-4 border-2 rounded-lg text-left transition-all ${
                        selectedBackend === backend.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        {getBackendIcon(backend)}
                        <span className="font-semibold text-gray-900 dark:text-white">{backend.name}</span>
                        {selectedBackend === backend.id && <CheckCircle className="w-4 h-4 text-blue-500 ml-auto" />}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {backend.description}
                      </p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`px-2 py-1 rounded ${
                          backend.requiresGPU 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}>
                          {backend.requiresGPU ? 'GPU Accelerated' : 'CPU Only'}
                        </span>
                        <span className="text-gray-500 dark:text-gray-500">•</span>
                        <span className="text-gray-500 dark:text-gray-500">{backend.folder}</span>
                      </div>
                    </button>
                  ))}
              </div>

              {/* Unavailable Backends */}
              {configInfo?.availableBackends.some(b => !b.isAvailable && b.id !== 'auto') && (
                <div className="mt-4">
                  <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Unavailable Backends:</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {configInfo.availableBackends
                      .filter(backend => !backend.isAvailable && backend.id !== 'auto') // Exclude 'auto' from unavailable list too
                      .map((backend) => (
                        <div
                          key={backend.id}
                          className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg opacity-50"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {getBackendIcon(backend)}
                            <span className="font-medium text-gray-700 dark:text-gray-300">{backend.name}</span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-500">Binaries not found</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Model Configuration Section */}
        <div className="space-y-4">
          <button
            onClick={() => toggleSection('models')}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Model Configuration</h4>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                ({modelConfigs.length} models)
              </span>
            </div>
            {expandedSections.models ? 
              <ChevronUp className="w-5 h-5 text-gray-400" /> : 
              <ChevronDown className="w-5 h-5 text-gray-400" />
            }
          </button>

          {expandedSections.models && (
            <div className="space-y-6">
              {modelConfigs.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <Database className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">No Models Found</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    No models are currently configured. Try regenerating the configuration.
                  </p>
                  <button
                    onClick={handleReconfigure}
                    disabled={isOperationInProgress}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Scan for Models
                  </button>
                </div>
              ) : (
                <>
                  {/* Models List */}
                  <div className="space-y-3">
                    {modelConfigs.map((model) => (
                      <div key={model.name} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                        {/* Model Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-2.5 h-2.5 rounded-full ${
                              model.status === 'running' ? 'bg-green-400' :
                              model.status === 'error' ? 'bg-red-400' : 'bg-gray-400'
                            }`} />
                            <div className="min-w-0 flex-1">
                              <h5 className="font-medium text-gray-900 dark:text-white text-sm">{model.name}</h5>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                                Port: {model.port}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {model.isEmbedding && (
                              <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs font-medium">
                                Embedding
                              </span>
                            )}
                            <button
                              onClick={() => saveModelConfiguration(model.name)}
                              disabled={isOperationInProgress}
                              className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              <Save className="w-3 h-3" />
                              Save
                            </button>
                          </div>
                        </div>

                        {/* Main Configuration - Compact Grid */}
                        <div className="grid grid-cols-3 gap-4 mb-3">
                          {/* Context Size */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                Context Size
                              </label>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {((model.configuredContextSize || model.nativeContextSize || 8192) / 1000).toFixed(0)}K
                              </span>
                            </div>
                            <input
                              type="range"
                              min="1024"
                              max={model.nativeContextSize || 32768}
                              step="1024"
                              value={model.configuredContextSize || model.nativeContextSize || 8192}
                              onChange={(e) => updateModelConfig(model.name, 'configuredContextSize', parseInt(e.target.value))}
                              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                              disabled={model.isEmbedding}
                            />
                          </div>

                          {/* GPU Layers */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                GPU Layers
                              </label>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {model.gpuLayers || 0}
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="1"
                              value={model.gpuLayers || 0}
                              onChange={(e) => updateModelConfig(model.name, 'gpuLayers', parseInt(e.target.value))}
                              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                            />
                          </div>

                          {/* Batch Size */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                Batch Size
                              </label>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {model.batchSize || 256}
                              </span>
                            </div>
                            <input
                              type="range"
                              min="32"
                              max="2048"
                              step="32"
                              value={model.batchSize || 256}
                              onChange={(e) => updateModelConfig(model.name, 'batchSize', parseInt(e.target.value))}
                              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                            />
                          </div>
                        </div>

                        {/* Advanced Settings Toggle */}
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
                          <button
                            onClick={() => setSelectedModelId(selectedModelId === model.name ? null : model.name)}
                            className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                          >
                            {selectedModelId === model.name ? 
                              <ChevronUp className="w-3 h-3" /> : 
                              <ChevronDown className="w-3 h-3" />
                            }
                            Advanced Settings
                          </button>

                          {selectedModelId === model.name && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                              {/* Threads */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                    Threads
                                  </label>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {model.threads || 4}
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min="1"
                                  max="16"
                                  step="1"
                                  value={model.threads || 4}
                                  onChange={(e) => updateModelConfig(model.name, 'threads', parseInt(e.target.value))}
                                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                                />
                              </div>

                              {/* TTL */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                    Timeout
                                  </label>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {Math.floor((model.ttl || 300) / 60)}m
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min="60"
                                  max="3600"
                                  step="60"
                                  value={model.ttl || 300}
                                  onChange={(e) => updateModelConfig(model.name, 'ttl', parseInt(e.target.value))}
                                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                                />
                              </div>

                              {/* Flash Attention */}
                              <div className="flex items-center justify-center">
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={model.flashAttention || false}
                                    onChange={(e) => updateModelConfig(model.name, 'flashAttention', e.target.checked)}
                                    className="rounded border-gray-300 dark:border-gray-600 w-3 h-3"
                                  />
                                  <span className="text-xs text-gray-700 dark:text-gray-300">Flash Attention</span>
                                </label>
                              </div>

                              {/* Memory Lock */}
                              <div className="flex items-center justify-center">
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={model.memoryLock || false}
                                    onChange={(e) => updateModelConfig(model.name, 'memoryLock', e.target.checked)}
                                    className="rounded border-gray-300 dark:border-gray-600 w-3 h-3"
                                  />
                                  <span className="text-xs text-gray-700 dark:text-gray-300">Memory Lock</span>
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Global Actions */}
                  <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {hasUnsavedChanges && (
                        <span className="text-orange-600 dark:text-orange-400 font-medium">
                          • You have unsaved changes
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleReconfigure}
                        disabled={isOperationInProgress}
                        className="px-3 py-1.5 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Rescan Models
                      </button>
                      <button
                        onClick={saveAllModelConfigurations}
                        disabled={isOperationInProgress || !hasUnsavedChanges}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        Save All Models
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Configuration Section */}
        <div className="space-y-4">
          <button
            onClick={() => toggleSection('configuration')}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Configuration Management</h4>
            </div>
            {expandedSections.configuration ? 
              <ChevronUp className="w-5 h-5 text-gray-400" /> : 
              <ChevronDown className="w-5 h-5 text-gray-400" />
            }
          </button>

          {expandedSections.configuration && (
            <div className="space-y-4">
              {/* Configuration Info */}
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Config Path:</span>
                    <p className="text-gray-600 dark:text-gray-400 font-mono text-xs mt-1 break-all">
                      {configInfo?.configPath}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Models Found:</span>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      {configInfo?.configuration?.models ? Object.keys(configInfo.configuration.models).length : 0} models
                    </p>
                  </div>
                </div>
              </div>

              {/* JSON Editor Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code className="w-5 h-5 text-gray-500" />
                  <span className="font-medium text-gray-900 dark:text-white">JSON Configuration Editor</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportConfiguration}
                    className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    Export
                  </button>
                  <label className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1 cursor-pointer">
                    <Upload className="w-3 h-3" />
                    Import
                    <input
                      type="file"
                      accept=".json"
                      onChange={importConfiguration}
                      className="hidden"
                    />
                  </label>
                  <button
                    onClick={() => setShowJsonEditor(!showJsonEditor)}
                    className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-sm hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-1"
                  >
                    {showJsonEditor ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {showJsonEditor ? 'Hide' : 'Show'} Editor
                  </button>
                </div>
              </div>

              {/* JSON Editor */}
              {showJsonEditor && (
                <div className="space-y-4">
                  {jsonError && (
                    <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded text-sm text-red-700 dark:text-red-300">
                      JSON Error: {jsonError}
                    </div>
                  )}
                  <textarea
                    value={jsonConfig}
                    onChange={(e) => handleJsonChange(e.target.value)}
                    className="w-full h-64 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm resize-vertical"
                    placeholder="Configuration JSON will appear here..."
                  />
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      <span>Lines: {jsonConfig.split('\n').length}</span>
                      <span className="mx-2">•</span>
                      <span>Characters: {jsonConfig.length}</span>
                      {hasUnsavedChanges && (
                        <>
                          <span className="mx-2">•</span>
                          <span className="text-orange-600 dark:text-orange-400 font-medium">Unsaved changes</span>
                        </>
                      )}
                    </div>
                    
                    {/* Save Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={saveConfiguration}
                        disabled={isOperationInProgress || !!jsonError || !hasUnsavedChanges}
                        className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-sm hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Save className="w-3 h-3" />
                        Save YAML
                      </button>
                      <button
                        onClick={saveConfigurationAndRestart}
                        disabled={isOperationInProgress || !!jsonError || !hasUnsavedChanges}
                        className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded text-sm hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Save className="w-3 h-3" />
                        Save & Restart
                      </button>
                    </div>
                  </div>
                  
                  {/* Configuration Help */}
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-1">Configuration Editing</p>
                        <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                          <li>• <strong>Save YAML:</strong> Saves changes to the configuration file. Manual edits are preserved!</li>
                          <li>• <strong>Save & Restart:</strong> Saves changes and restarts the service to apply them immediately</li>
                          <li>• Configuration is automatically backed up before saving</li>
                          <li>• JSON must be valid before saving is allowed</li>
                          <li>• <strong>Important:</strong> Manual edits won't be overwritten by performance settings</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Advanced Operations */}
        <div className="space-y-4">
          <button
            onClick={() => toggleSection('advanced')}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Advanced Operations</h4>
            </div>
            {expandedSections.advanced ? 
              <ChevronUp className="w-5 h-5 text-gray-400" /> : 
              <ChevronDown className="w-5 h-5 text-gray-400" />
            }
          </button>

          {expandedSections.advanced && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Force Reconfigure */}
              <button
                onClick={handleReconfigure}
                disabled={isOperationInProgress}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
              >
                <div className="flex items-center gap-2 mb-2">
                  <RefreshCw className="w-5 h-5 text-blue-500" />
                  <span className="font-medium text-gray-900 dark:text-white">Force Reconfigure</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Regenerate configuration with current settings and backend overrides
                </p>
              </button>

              {/* Restart with Overrides */}
              <button
                onClick={handleRestartWithOverrides}
                disabled={isOperationInProgress}
                className="p-4 border border-orange-200 dark:border-orange-700 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors text-left"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Play className="w-5 h-5 text-orange-500" />
                  <span className="font-medium text-gray-900 dark:text-white">Restart Service</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Stop, reconfigure, and restart the service with all current settings
                </p>
              </button>
            </div>
          )}
        </div>

        {/* System Information */}
        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Configuration Studio Features</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">🎯 Backend Management:</p>
                  <p className="text-gray-600 dark:text-gray-400">Force specific GPU backends (CUDA, ROCm, Vulkan) or use intelligent auto-detection</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">⚡ Live Configuration:</p>
                  <p className="text-gray-600 dark:text-gray-400">Edit YAML configuration as JSON, export/import configs, and apply changes instantly</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">🔄 Smart Restart:</p>
                  <p className="text-gray-600 dark:text-gray-400">Intelligent service restart with configuration validation and rollback protection</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">🛠️ Advanced Control:</p>
                  <p className="text-gray-600 dark:text-gray-400">Professional-grade configuration management with real-time status monitoring</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackendConfigurationPanel; 