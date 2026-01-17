# 📝 Detailed Step-by-Step: Paano i-Add ang Column sa Database

## 🎯 Goal: Add `accepting_responses` column sa `forms` table

---

## **STEP 1: Open Docker Desktop**

1. **Open Docker Desktop application** sa Windows
2. Wait until makita mo ang "Engine running" sa bottom
3. **Click sa "Containers"** sa left sidebar (dapat naka-highlight na)

---

## **STEP 2: Find the Database Container**

1. Sa main area, hanapin mo ang **"gleentforms-main"** project
2. Makikita mo ang 3 services:
   - `db` (green dot) - **ITO ANG KUKUNIN NATIN**
   - `backend` (purple dot)
   - `frontend` (purple dot)
3. **Click sa `db` service** (yung may green dot at `mysql:8.0`)

---

## **STEP 3: Open Terminal/Exec Tab**

1. Pag-click mo sa `db`, may lalabas na panel sa right side
2. Sa top ng panel, may **tabs**: "Logs", "Inspect", "Bind mounts", **"Exec"**, "Files", "Stats"
3. **Click sa "Exec" tab**
4. May makikita kang button na **"Connect"** o **"Open in terminal"**
5. **Click mo yun**

---

## **STEP 4: Terminal Window Opens**

1. May lalabas na **black terminal window** sa loob ng Docker Desktop
2. May makikita kang prompt na ganito:
   ```
   sh-5.1# 
   ```
   O kaya:
   ```
   / # 
   ```

---

## **STEP 5: Connect to MySQL**

**Type mo EXACTLY ito** (copy-paste mo na lang):

```bash
mysql -u root -prootpassword gleentforms
```

**Press Enter**

**Expected output:**
```
Welcome to the MySQL monitor. Commands end with ; or \g.
Your MySQL connection id is XXXX
Server version: 8.0.XX MySQL Community Server - GPL

Copyright (c) 2000, 2025, Oracle and/or its affiliates.

Type 'help;' or '\h' for help. Type '\c' to clear the current input buffer.

mysql> 
```

**Note:** Kung may error na "Access denied", iba ang password mo. Check mo sa `.env` file o `docker-compose.dev.yml` ang `MYSQL_ROOT_PASSWORD`.

---

## **STEP 6: Add the Column**

**Type mo EXACTLY ito** (copy-paste mo na lang):

```sql
ALTER TABLE forms ADD COLUMN accepting_responses BOOLEAN DEFAULT TRUE;
```

**Press Enter**

**Expected output:**
```
Query OK, 0 rows affected (0.XX sec)
Records: 0  Duplicates: 0  Warnings: 0
```

**Meaning:** ✅ Success! Na-add na ang column.

---

## **STEP 7: Verify (Optional pero Recommended)**

**Type mo:**
```sql
DESCRIBE forms;
```

**Press Enter**

**Expected output:**
Makikita mo ang list ng columns, dapat may:
```
| accepting_responses | tinyint(1) | YES  |     | 1       |                |
```

**Meaning:** ✅ Column exists!

---

## **STEP 8: Exit MySQL**

**Type mo:**
```sql
EXIT;
```

**Press Enter**

**O kaya:**
```sql
quit;
```

**Press Enter**

Dapat makita mo ulit ang:
```
sh-5.1# 
```

---

## **STEP 9: Close Terminal (Optional)**

1. Pwede mo na i-close ang terminal window
2. O kaya iwan mo lang, okay lang din

---

## **STEP 10: Restart Backend Container**

1. **Bumalik sa main Docker Desktop window**
2. **Click sa "Containers"** sa left sidebar
3. **Hanapin ang `backend` service** (yung may purple dot)
4. **Click sa `backend` service**
5. Sa right panel, sa top-right, may **restart button** (circular arrow icon)
6. **Click mo yun**

**O kaya:**
- Right-click sa `backend` service
- Click **"Restart"**

---

## **STEP 11: Wait for Backend to Restart**

1. **Click sa "Logs" tab** ng backend container
2. Wait until makita mo:
   ```
   * Running on http://localhost:5000
   ```
3. **Meaning:** ✅ Backend is running!

---

## **STEP 12: Refresh Browser**

1. **Go back sa browser** (Chrome/Edge)
2. **Press F5** o **Ctrl+R** para mag-refresh
3. **Dapat wala nang error!** ✅

---

## 🐛 Troubleshooting

### **Error: "Access denied"**
**Solution:** 
- Check password sa `.env` file o `docker-compose.dev.yml`
- Look for `MYSQL_ROOT_PASSWORD` o `DB_PASSWORD`
- Use that password instead of `rootpassword`

### **Error: "Duplicate column name"**
**Meaning:** Column na naka-add na
**Solution:** Skip Step 6, proceed to Step 10

### **Error: "Unknown database 'gleentforms'"**
**Solution:**
- Check database name: `SHOW DATABASES;`
- Use correct database name

### **Terminal hindi nag-o-open**
**Solution:**
- Try clicking "Exec" tab ulit
- O kaya restart Docker Desktop

---

## 📋 Quick Reference

**Container Name:** `gleentforms-db-dev`

**Database Name:** `gleentforms`

**Username:** `root`

**Password:** `rootpassword` (check mo sa `.env` kung iba)

**SQL Command:**
```sql
ALTER TABLE forms ADD COLUMN accepting_responses BOOLEAN DEFAULT TRUE;
```

---

**That's it! Follow mo lang step by step.** 🎉

