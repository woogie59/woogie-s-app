# Smart Macro Calculator - Usage Guide

## Access
**From User Dashboard:**
```
CLIENT HOME → MACRO CALCULATOR button
```

---

## Input Form

### 1. Goal Selection
**Three strategic options:**

🎯 **Body Profile (체지방 감량)**
- High protein: 2.2g per kg body weight
- Low carbs: 25% of calories
- Strategy: Preserve muscle while losing fat

🎯 **Diet (다이어트)**
- Moderate protein: 1.8g per kg
- Moderate carbs: 35% of calories
- Strategy: Balanced approach for healthy weight loss

🎯 **Muscle Gain (근육 증량)**
- High carbs: 50% of calories
- Moderate protein: 1.6g per kg
- Strategy: Energy surplus for muscle growth

### 2. Physical Stats
```
Height: [170] cm
Weight: [70] kg
Age: [30]
Gender: [남성 / 여성]
```

### 3. Calculate
Click **"CALCULATE MACROS"** button

---

## Output Display

### Card 1: 📊 Calorie Information
```
BMR:  1,618 kcal/day
TDEE: 2,224 kcal/day
```

**BMR:** Energy your body burns at rest  
**TDEE:** Total energy burned including activity

### Card 2: 🍽️ Daily Macros (Total)
```
Carbs:   195g  (blue)
Protein: 126g  (red)
Fat:     74g   (green)
```

### Card 3: ⭐ Per Meal (4 meals/day) ← HIGHLIGHTED
```
┌──────────────────────────┐
│ 탄수화물    49g          │
│ 단백질      32g          │
│ 지방        19g          │
└──────────────────────────┘
```

**This is the key output** - tells you exactly how much of each macro to eat per meal!

### Card 4: 📋 Your Goal Strategy
Brief explanation of your selected goal's approach.

---

## Example Meal Plan (Diet Goal)

### Per Meal Targets:
- 49g Carbs
- 32g Protein
- 19g Fat

### Sample Meal:
```
🍚 Carbs (49g):
   - 1 cup cooked rice (45g) = 180 kcal
   
🥩 Protein (32g):
   - 150g chicken breast (32g) = 165 kcal
   
🥑 Fat (19g):
   - 1 tbsp olive oil (14g)
   - Natural fats from chicken (5g)
   Total = 171 kcal

Total Meal: ~516 kcal
```

Eat 4 similar meals = ~2,064 kcal/day (close to TDEE)

---

## Goal-Specific Meal Examples

### Body Profile (High Protein, Low Carb)
```
Example Meal:
- 200g grilled salmon (40g protein)
- 1/2 cup quinoa (20g carbs)
- Large salad with olive oil (15g fat)
- Protein shake (20g protein)
```

### Diet (Balanced)
```
Example Meal:
- 150g chicken breast (32g protein)
- 1 cup rice (45g carbs)
- Steamed vegetables
- 1 tbsp oil (14g fat)
```

### Muscle Gain (High Carb)
```
Example Meal:
- 150g lean beef (30g protein)
- 1.5 cups rice (70g carbs)
- Sweet potato (30g carbs)
- Avocado (15g fat)
```

---

## BMR Formula Breakdown

### Mifflin-St Jeor (Most Accurate)

**For Males:**
```
BMR = (10 × weight kg) + (6.25 × height cm) - (5 × age years) + 5
```

**For Females:**
```
BMR = (10 × weight kg) + (6.25 × height cm) - (5 × age years) - 161
```

**Example (Male, 70kg, 170cm, 30 years):**
```
BMR = (10 × 70) + (6.25 × 170) - (5 × 30) + 5
    = 700 + 1,062.5 - 150 + 5
    = 1,617.5 kcal/day
```

---

## Activity Factors (We use 1.375)

| Level | Factor | Description |
|-------|--------|-------------|
| Sedentary | 1.2 | Desk job, no exercise |
| Light | 1.375 | Light exercise 1-3 days/week |
| **Moderate** | **1.55** | **Exercise 3-5 days/week** ← We use 1.375 (conservative) |
| Very Active | 1.725 | Hard exercise 6-7 days/week |
| Extreme | 1.9 | Physical job + training |

**Why 1.375?**
- Conservative estimate
- Better for controlled results
- Prevents overeating
- Suitable for gym members (3-5 sessions/week)

---

## Macro Calculation Logic

### Step 1: Calculate Protein
```javascript
const proteinG = weight × proteinGPerKg;
// Example: 70kg × 1.8 = 126g
```

### Step 2: Calculate Carbs
```javascript
const carbsCal = TDEE × carbsPercent;
const carbsG = carbsCal / 4; // 4 kcal per gram
// Example: 2,224 × 0.35 = 778 kcal → 195g
```

### Step 3: Calculate Fat
```javascript
const fatCal = TDEE × fatPercent;
const fatG = fatCal / 9; // 9 kcal per gram
// Example: 2,224 × 0.30 = 667 kcal → 74g
```

### Step 4: Divide by 4 Meals
```javascript
carbsPerMeal = Math.round(carbsG / 4);
proteinPerMeal = Math.round(proteinG / 4);
fatPerMeal = Math.round(fatG / 4);
```

---

## Using the Results

### Meal Prep Strategy

**Morning (Meal 1):**
- Pre-workout energy
- Higher carbs for performance

**Lunch (Meal 2):**
- Balanced all macros
- Main meal of the day

**Afternoon (Meal 3):**
- Post-workout recovery
- Protein + carbs for muscle repair

**Dinner (Meal 4):**
- Lower carbs
- Higher protein + healthy fats
- Better for sleep quality

---

## Food Measurement Tips

### Carbs (쉽게 측정하기)
```
1 fist = ~30g carbs (1 cup rice)
1 palm = ~15g carbs (1 slice bread)
```

### Protein (쉽게 측정하기)
```
1 palm = ~25g protein (100g meat)
1 egg = ~6g protein
```

### Fat (쉽게 측정하기)
```
1 thumb = ~10g fat (1 tbsp oil/butter)
Handful nuts = ~15g fat
```

---

## Tracking Apps

Recommend these for precise tracking:
1. **MyFitnessPal** - Largest food database
2. **Lose It!** - Simple UI
3. **Cronometer** - Most accurate micronutrients

---

## Adjustment Guidelines

### If Losing Weight Too Fast
- Add 200-300 kcal (mostly carbs)
- Increase activity factor to 1.55

### If Not Losing Weight
- Reduce 200-300 kcal (from carbs)
- Increase cardio
- Check food portions accuracy

### If Gaining Too Much Fat
- Reduce carbs by 20-30g per day
- Increase protein by 10-15g

---

## Status
✅ Implemented in `App.jsx`  
✅ Scientifically accurate formulas  
✅ Goal-specific strategies  
✅ Per-meal calculations  
✅ Professional UI with color coding
