export const locales = ['ar', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'ar';

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function dir(locale: Locale) {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

// Deliberately not `as const`: the English dictionary has to satisfy this same
// shape, and literal types would make every translated string a type error.
const ar = {
  meta: {
    title: 'مُزيل — إزالة خلفية الصور بالذكاء الاصطناعي',
    description:
      'أزل خلفية أي صورة في ثوانٍ، بدقة كاملة وبدون علامة مائية. المعالجة تتم داخل متصفحك، وصورك لا تغادر جهازك.',
    ogAlt: 'مُزيل — إزالة خلفية الصور',
  },
  nav: {
    brand: 'مُزيل',
    tagline: 'إزالة الخلفيات',
    switchLang: 'English',
    github: 'المصدر',
  },
  hero: {
    badge: 'يعمل داخل متصفحك',
    title: 'أزل خلفية صورتك',
    titleAccent: 'في ثانية واحدة',
    subtitle:
      'ارفع صورة واحصل على خلفية شفافة بدقة كاملة — بدون علامة مائية، وبدون تسجيل دخول.',
    privacyNote: 'صورك تُعالَج على جهازك ولا تُرفَع إلى أي خادم.',
  },
  dropzone: {
    title: 'اسحب صورتك هنا',
    subtitle: 'أو اضغط للاختيار من جهازك',
    paste: 'يمكنك أيضاً اللصق مباشرة بـ Ctrl+V',
    formats: 'PNG أو JPG أو WEBP — حتى ٣٠ ميجابايت',
    button: 'اختر صورة',
    tryExample: 'أو جرّب على مثال جاهز:',
    exampleAlt: 'صورة تجريبية',
  },
  features: {
    title: 'لماذا مُزيل؟',
    items: [
      {
        title: 'خصوصية كاملة',
        body: 'المعالجة تتم داخل متصفحك بالكامل. صورتك لا تغادر جهازك ولا تُخزَّن في أي مكان.',
      },
      {
        title: 'دقة أصلية',
        body: 'تحصل على الصورة بنفس أبعادها الأصلية — بدون تصغير وبدون علامة مائية.',
      },
      {
        title: 'تصحيح يدوي',
        body: 'فرشاة لاسترجاع أو مسح أي جزء، لأن أفضل نموذج يخطئ أحياناً.',
      },
      {
        title: 'يعمل بدون إنترنت',
        body: 'بعد أول استخدام، يبقى المحرّك محفوظاً في متصفحك ويعمل حتى بدون اتصال.',
      },
    ],
  },
  engine: {
    preparing: 'جارٍ تحضير المحرك',
    preparingHint: 'تنزيل لمرة واحدة — يُحفَظ في متصفحك بعدها',
    downloading: 'تنزيل المحرك',
    loading: 'تشغيل المحرك',
    processing: 'جارٍ إزالة الخلفية',
    reading: 'قراءة الصورة',
    refining: 'تحسين الحواف',
    done: 'تم',
    localBadge: 'معالجة على جهازك',
    serverBadge: 'معالجة عالية الجودة',
    localReady: 'المحرك جاهز على جهازك — الصور القادمة تُعالَج محلياً',
  },
  editor: {
    newImage: 'صورة جديدة',
    download: 'تنزيل',
    downloading: 'جارٍ التحضير…',
    reset: 'إعادة تعيين',
    undo: 'تراجع',
    redo: 'إعادة',
    compare: 'مقارنة',
    original: 'الأصلية',
    result: 'النتيجة',
    zoomIn: 'تكبير',
    zoomOut: 'تصغير',
    fit: 'ملء الشاشة',
    tabs: {
      background: 'الخلفية',
      brush: 'الفرشاة',
      edges: 'الحواف',
      export: 'التصدير',
    },
    background: {
      title: 'الخلفية',
      transparent: 'شفافة',
      color: 'لون',
      gradient: 'تدرّج',
      image: 'صورة',
      pickColor: 'اختر لوناً',
      uploadImage: 'ارفع صورة خلفية',
      removeImage: 'إزالة صورة الخلفية',
      shadow: 'ظل تحت العنصر',
      shadowHint: 'يضيف ظلاً ناعماً — مفيد لصور المنتجات',
      shadowBlur: 'نعومة الظل',
      shadowOpacity: 'شدة الظل',
      shadowOffset: 'إزاحة الظل',
    },
    brush: {
      title: 'تصحيح يدوي',
      hint: 'ارسم على الصورة لاسترجاع جزء محذوف أو مسح جزء زائد.',
      restore: 'استرجاع',
      erase: 'مسح',
      size: 'حجم الفرشاة',
      hardness: 'حدّة الفرشاة',
      panHint: 'اضغط مسافة + اسحب للتحريك',
    },
    edges: {
      title: 'ضبط الحواف',
      feather: 'تنعيم الحواف',
      shrink: 'تضييق / توسيع',
      threshold: 'حدّة الفصل',
      hint: 'زد التنعيم للشعر والفراء، وضيّق الحواف لو ظهر خط فاتح حول العنصر.',
    },
    export: {
      title: 'التصدير',
      format: 'الصيغة',
      png: 'PNG — شفاف',
      webp: 'WEBP — أصغر حجماً',
      jpg: 'JPG — بخلفية',
      jpgNote: 'JPG لا يدعم الشفافية، ستُصدَّر الصورة بالخلفية المختارة.',
      quality: 'الجودة',
      size: 'المقاس',
      sizeOriginal: 'الأبعاد الأصلية',
      trim: 'قص حول العنصر',
      trimHint: 'يزيل الفراغ الشفاف الزائد حول العنصر',
      padding: 'هامش',
      dimensions: 'الأبعاد',
      estimated: 'الحجم التقريبي',
    },
  },
  quality: {
    title: 'جودة المعالجة',
    auto: 'تلقائي',
    local: 'على جهازي',
    server: 'جودة عالية (خادم)',
    localHint: 'أسرع وأكثر خصوصية — لا شيء يُرفَع.',
    serverHint: 'نموذج أكبر ودقة أعلى للحواف — تُرفَع الصورة مؤقتاً للمعالجة.',
    serverUnavailable: 'المعالجة على الخادم غير متاحة حالياً.',
  },
  errors: {
    tooLarge: 'حجم الملف أكبر من ٣٠ ميجابايت. جرّب صورة أصغر.',
    tooManyPixels: 'أبعاد الصورة كبيرة جداً (الحد ٣٠ ميجابكسل).',
    badFormat: 'صيغة غير مدعومة. استخدم PNG أو JPG أو WEBP.',
    corrupt: 'تعذّرت قراءة الصورة — قد يكون الملف تالفاً.',
    noEngine:
      'متصفحك لا يدعم WebGPU، والمعالجة على الخادم غير متاحة حالياً. جرّب Chrome أو Edge أو Safari بإصدار حديث.',
    engineFailed: 'فشل تشغيل المحرك على جهازك.',
    networkModel: 'تعذّر تنزيل المحرك. تحقّق من اتصالك وأعد المحاولة.',
    serverFailed: 'تعذّرت المعالجة على الخادم.',
    rateLimited: 'تجاوزت الحد المسموح. حاول مرة أخرى بعد قليل، أو استخدم المعالجة على جهازك.',
    unknown: 'حدث خطأ غير متوقع.',
    retry: 'إعادة المحاولة',
    dismiss: 'إغلاق',
  },
  footer: {
    builtWith: 'مبني على نموذج BiRefNet مفتوح المصدر برخصة MIT.',
    privacy: 'لا نجمع صورك ولا نخزّنها.',
  },
};

type Dictionary = typeof ar;

const en: Dictionary = {
  meta: {
    title: 'Muzeel — AI Background Remover',
    description:
      'Remove any image background in seconds, at full resolution with no watermark. Processing happens in your browser — your images never leave your device.',
    ogAlt: 'Muzeel — AI Background Remover',
  },
  nav: {
    brand: 'Muzeel',
    tagline: 'Background Removal',
    switchLang: 'العربية',
    github: 'Source',
  },
  hero: {
    badge: 'Runs in your browser',
    title: 'Remove your background',
    titleAccent: 'in one second',
    subtitle:
      'Upload an image and get a transparent cutout at full resolution — no watermark, no sign-up.',
    privacyNote: 'Your images are processed on your device and never uploaded.',
  },
  dropzone: {
    title: 'Drop your image here',
    subtitle: 'or click to pick one from your device',
    paste: 'You can also paste directly with Ctrl+V',
    formats: 'PNG, JPG or WEBP — up to 30 MB',
    button: 'Choose an image',
    tryExample: 'Or try a sample:',
    exampleAlt: 'Sample image',
  },
  features: {
    title: 'Why Muzeel?',
    items: [
      {
        title: 'Fully private',
        body: 'Processing runs entirely in your browser. Your image never leaves your device and is never stored.',
      },
      {
        title: 'Original resolution',
        body: 'You get the image at its exact original dimensions — no downscaling, no watermark.',
      },
      {
        title: 'Manual touch-up',
        body: 'A brush to restore or erase any area, because even the best model gets it wrong sometimes.',
      },
      {
        title: 'Works offline',
        body: 'After the first use the engine stays cached in your browser and works without a connection.',
      },
    ],
  },
  engine: {
    preparing: 'Preparing the engine',
    preparingHint: 'One-time download — cached in your browser afterwards',
    downloading: 'Downloading engine',
    loading: 'Starting engine',
    processing: 'Removing background',
    reading: 'Reading image',
    refining: 'Refining edges',
    done: 'Done',
    localBadge: 'Processed on your device',
    serverBadge: 'High-quality processing',
    localReady: 'Engine ready on your device — next images are processed locally',
  },
  editor: {
    newImage: 'New image',
    download: 'Download',
    downloading: 'Preparing…',
    reset: 'Reset',
    undo: 'Undo',
    redo: 'Redo',
    compare: 'Compare',
    original: 'Original',
    result: 'Result',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fit: 'Fit to screen',
    tabs: {
      background: 'Background',
      brush: 'Brush',
      edges: 'Edges',
      export: 'Export',
    },
    background: {
      title: 'Background',
      transparent: 'Transparent',
      color: 'Color',
      gradient: 'Gradient',
      image: 'Image',
      pickColor: 'Pick a color',
      uploadImage: 'Upload a background image',
      removeImage: 'Remove background image',
      shadow: 'Drop shadow',
      shadowHint: 'Adds a soft shadow — useful for product shots',
      shadowBlur: 'Shadow blur',
      shadowOpacity: 'Shadow strength',
      shadowOffset: 'Shadow offset',
    },
    brush: {
      title: 'Manual touch-up',
      hint: 'Paint on the image to restore a removed area or erase an extra one.',
      restore: 'Restore',
      erase: 'Erase',
      size: 'Brush size',
      hardness: 'Brush hardness',
      panHint: 'Hold Space + drag to pan',
    },
    edges: {
      title: 'Edge tuning',
      feather: 'Feather',
      shrink: 'Shrink / grow',
      threshold: 'Cutoff strength',
      hint: 'Increase feathering for hair and fur; shrink the edge if a light fringe shows around the subject.',
    },
    export: {
      title: 'Export',
      format: 'Format',
      png: 'PNG — transparent',
      webp: 'WEBP — smaller file',
      jpg: 'JPG — with background',
      jpgNote: 'JPG has no transparency; the image is exported with the selected background.',
      quality: 'Quality',
      size: 'Size',
      sizeOriginal: 'Original dimensions',
      trim: 'Trim to subject',
      trimHint: 'Removes the extra transparent space around the subject',
      padding: 'Padding',
      dimensions: 'Dimensions',
      estimated: 'Estimated size',
    },
  },
  quality: {
    title: 'Processing quality',
    auto: 'Automatic',
    local: 'On my device',
    server: 'High quality (server)',
    localHint: 'Faster and more private — nothing is uploaded.',
    serverHint: 'Larger model with sharper edges — the image is uploaded temporarily.',
    serverUnavailable: 'Server processing is currently unavailable.',
  },
  errors: {
    tooLarge: 'The file is larger than 30 MB. Try a smaller image.',
    tooManyPixels: 'The image is too large (30 megapixel limit).',
    badFormat: 'Unsupported format. Use PNG, JPG or WEBP.',
    corrupt: 'Could not read the image — the file may be corrupt.',
    noEngine:
      'Your browser does not support WebGPU and server processing is unavailable. Try a recent Chrome, Edge or Safari.',
    engineFailed: 'The engine failed to start on your device.',
    networkModel: 'Could not download the engine. Check your connection and try again.',
    serverFailed: 'Server processing failed.',
    rateLimited: 'You have hit the limit. Try again shortly, or switch to on-device processing.',
    unknown: 'Something went wrong.',
    retry: 'Try again',
    dismiss: 'Dismiss',
  },
  footer: {
    builtWith: 'Built on the open-source BiRefNet model, MIT licensed.',
    privacy: 'We never collect or store your images.',
  },
};

const dictionaries: Record<Locale, Dictionary> = { ar, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary };
