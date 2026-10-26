import { useState, useRef } from "react";
import { Calendar, Watch, Upload, FileText, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

interface ParsedPeriodEntry {
  startDate: string;
  endDate?: string;
}

interface PeriodLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogManual: (startDate: string, endDate?: string) => void;
  onImportFromDevice: (entries: ParsedPeriodEntry[]) => void;
  isLoading?: boolean;
}

export default function PeriodLogDialog({
  open,
  onOpenChange,
  onLogManual,
  onImportFromDevice,
  isLoading = false,
}: PeriodLogDialogProps) {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState('');
  const [includeEndDate, setIncludeEndDate] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedEntries, setParsedEntries] = useState<ParsedPeriodEntry[]>([]);
  const [csvError, setCsvError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleManualSubmit = () => {
    if (!startDate) {
      setValidationError('Please select a start date');
      return;
    }
    if (includeEndDate && !endDate) {
      setValidationError('Please select an end date or uncheck the option');
      return;
    }
    if (includeEndDate && endDate && new Date(endDate) < new Date(startDate)) {
      setValidationError('End date must be after start date');
      return;
    }
    setValidationError('');
    onLogManual(startDate, includeEndDate && endDate ? endDate : undefined);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isLoading && !isImporting) {
      setStartDate(format(new Date(), 'yyyy-MM-dd'));
      setEndDate('');
      setIncludeEndDate(false);
      setValidationError('');
      setCsvFile(null);
      setParsedEntries([]);
      setCsvError('');
      onOpenChange(false);
    }
  };

  const parseCSV = (content: string): ParsedPeriodEntry[] => {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];
    
    const header = lines[0].toLowerCase();
    const entries: ParsedPeriodEntry[] = [];
    
    // Try to detect column indices for common formats
    const columns = header.split(',').map(c => c.trim().replace(/"/g, ''));
    let startIdx = columns.findIndex(c => 
      c.includes('start') || c.includes('period_start') || c.includes('begin') || c === 'date'
    );
    let endIdx = columns.findIndex(c => 
      c.includes('end') || c.includes('period_end') || c.includes('finish')
    );
    
    // Default to first two columns if not found
    if (startIdx === -1) startIdx = 0;
    if (endIdx === -1 && columns.length > 1) endIdx = 1;

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      if (values.length > startIdx && values[startIdx]) {
        const startDate = parseDate(values[startIdx]);
        const endDate = endIdx >= 0 && values[endIdx] ? parseDate(values[endIdx]) : undefined;
        if (startDate) {
          entries.push({ startDate, endDate });
        }
      }
    }
    return entries;
  };

  const parseDate = (dateStr: string): string | undefined => {
    // Handle various date formats
    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
      /^(\d{2})\/(\d{2})\/(\d{4})$/, // MM/DD/YYYY
      /^(\d{2})-(\d{2})-(\d{4})$/, // MM-DD-YYYY
    ];
    
    for (const regex of formats) {
      const match = dateStr.match(regex);
      if (match) {
        if (regex === formats[0]) {
          return dateStr; // Already ISO format
        } else {
          const [, m, d, y] = match;
          return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
      }
    }
    
    // Try parsing with Date
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return format(date, 'yyyy-MM-dd');
    }
    return undefined;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setCsvFile(file);
    setCsvError('');
    setParsedEntries([]);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const entries = parseCSV(content);
        if (entries.length === 0) {
          setCsvError('No valid period entries found in the file. Please check the format.');
        } else {
          setParsedEntries(entries);
        }
      } catch {
        setCsvError('Failed to parse CSV file. Please check the format.');
      }
    };
    reader.onerror = () => {
      setCsvError('Failed to read file.');
    };
    reader.readAsText(file);
  };

  const handleImportEntries = async () => {
    if (parsedEntries.length === 0) return;
    setIsImporting(true);
    try {
      onImportFromDevice(parsedEntries);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-period-log">
        <DialogHeader>
          <DialogTitle>Log Period</DialogTitle>
          <DialogDescription>
            Manually enter your period dates or import from your wearable device.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual" data-testid="tab-manual-entry">
              <Calendar className="w-4 h-4 mr-2" />
              Manual Entry
            </TabsTrigger>
            <TabsTrigger value="device" data-testid="tab-device-import">
              <Watch className="w-4 h-4 mr-2" />
              Import Data
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Period Start Date *</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setValidationError('');
                }}
                max={format(new Date(), 'yyyy-MM-dd')}
                data-testid="input-start-date"
              />
              <p className="text-sm text-muted-foreground">
                Select the first day of your period
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="include-end-date"
                checked={includeEndDate}
                onChange={(e) => {
                  setIncludeEndDate(e.target.checked);
                  setValidationError('');
                }}
                className="rounded border-input"
                data-testid="checkbox-include-end-date"
              />
              <Label htmlFor="include-end-date" className="font-normal cursor-pointer">
                Include end date (if period has ended)
              </Label>
            </div>

            {includeEndDate && (
              <div className="space-y-2">
                <Label htmlFor="end-date">Period End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setValidationError('');
                  }}
                  min={startDate}
                  max={format(new Date(), 'yyyy-MM-dd')}
                  data-testid="input-end-date"
                />
                <p className="text-sm text-muted-foreground">
                  Select the last day of your period
                </p>
              </div>
            )}

            {validationError && (
              <div className="text-sm text-destructive" data-testid="text-validation-error">
                {validationError}
              </div>
            )}

            <Button 
              onClick={handleManualSubmit} 
              className="w-full"
              data-testid="button-submit-manual"
              disabled={isLoading}
            >
              {isLoading ? 'Logging...' : 'Log Period'}
            </Button>
          </TabsContent>

          <TabsContent value="device" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="text-center pb-2">
                <h3 className="font-semibold">Import Period Data</h3>
                <p className="text-sm text-muted-foreground">
                  Upload a CSV file exported from your wearable device or period tracking app.
                </p>
              </div>

              <div 
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover-elevate"
                onClick={() => fileInputRef.current?.click()}
                data-testid="dropzone-csv"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  data-testid="input-csv-file"
                />
                <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">
                  {csvFile ? csvFile.name : 'Click to upload CSV file'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports exports from Fitbit, Oura, Garmin, Clue, Flo
                </p>
              </div>

              {csvError && (
                <div className="flex items-center gap-2 text-sm text-destructive" data-testid="text-csv-error">
                  <AlertCircle className="w-4 h-4" />
                  {csvError}
                </div>
              )}

              {parsedEntries.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <FileText className="w-4 h-4" />
                    Found {parsedEntries.length} period entries
                  </div>
                  <div className="max-h-32 overflow-y-auto border rounded-md p-2 text-xs space-y-1">
                    {parsedEntries.slice(0, 5).map((entry, i) => (
                      <div key={i} className="flex justify-between text-muted-foreground">
                        <span>Start: {entry.startDate}</span>
                        {entry.endDate && <span>End: {entry.endDate}</span>}
                      </div>
                    ))}
                    {parsedEntries.length > 5 && (
                      <div className="text-muted-foreground">
                        ...and {parsedEntries.length - 5} more entries
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Button 
                onClick={handleImportEntries} 
                className="w-full"
                disabled={parsedEntries.length === 0 || isImporting || isLoading}
                data-testid="button-import-csv"
              >
                {isImporting ? 'Importing...' : `Import ${parsedEntries.length} Entries`}
              </Button>

              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium">Expected CSV format:</p>
                <code className="block bg-muted p-2 rounded text-xs">
                  start_date,end_date<br/>
                  2024-01-15,2024-01-19<br/>
                  2024-02-12,2024-02-17
                </code>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
