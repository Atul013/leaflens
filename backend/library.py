"""Class names from emmarex/plantdisease; general observation guidance."""
CLASSES = [
    'Pepper__bell___Bacterial_spot', 'Pepper__bell___healthy',
    'Potato___Early_blight', 'Potato___Late_blight', 'Potato___healthy',
    'Tomato___Bacterial_spot', 'Tomato___Early_blight', 'Tomato___Late_blight',
    'Tomato___Leaf_Mold', 'Tomato___Septoria_leaf_spot',
    'Tomato___Spider_mites Two-spotted_spider_mite', 'Tomato___Target_Spot',
    'Tomato___Tomato_Yellow_Leaf_Curl_Virus', 'Tomato___Tomato_mosaic_virus', 'Tomato___healthy',
]

SYMPTOMS = {
    'Early blight': 'Look for brown lesions, sometimes with concentric rings, and surrounding yellowing.',
    'Late blight': 'Look for irregular dark lesions and rapid changes across multiple leaves.',
    'Bacterial spot': 'Look for small dark spots; compare both leaf surfaces and several plants.',
    'Leaf mold': 'Compare yellowing on the upper surface with discoloration beneath the leaf.',
    'Septoria leaf spot': 'Look for numerous small spots with darker margins and lighter centers.',
    'Target spot': 'Look for round brown lesions; several diseases can produce similar patterns.',
    'Spider mites': 'Check for stippling and fine webbing; inspect the underside with a magnifier.',
    'Yellow leaf curl virus': 'Check for leaf curling, yellowing and altered growth; symptoms need expert confirmation.',
    'Mosaic virus': 'Check for mottled light and dark areas and changes in leaf shape.',
    'Healthy': 'No recognized disease class was selected. This does not rule out an unseen condition.',
}


def class_info(label):
    crop = 'Bell pepper' if label.startswith('Pepper') else label.split('_')[0]
    lower = label.lower()
    if 'healthy' in lower:
        condition = 'Healthy'
    elif 'yellowleaf' in lower or 'yellow_leaf' in lower:
        condition = 'Yellow leaf curl virus'
    elif 'mosaic' in lower:
        condition = 'Mosaic virus'
    elif 'spider' in lower:
        condition = 'Spider mites'
    else:
        raw = label.split('___', 1)[1] if '___' in label else label[len(crop):].strip('_')
        condition = ' '.join(raw.replace('_', ' ').split()).capitalize()
    symptoms = SYMPTOMS.get(condition, 'Compare the photographed leaf with several leaves from the same plant. Similar visual symptoms can have different causes.')
    return {'id': label, 'crop': crop, 'condition': condition, 'healthy': condition == 'Healthy', 'symptoms': symptoms,
            'guidance': ['Photograph both sides in natural light.', 'Check several leaves and record when changes began.',
                         'Ask a local agricultural extension expert to confirm the cause before choosing a treatment.']}
