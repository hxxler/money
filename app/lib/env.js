import Realm from 'realm';
import {
    Alert,
    ToastAndroid,
} from 'react-native';
import moment from 'moment';


export default class Env {

    static getRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }

        return color;
    }

    static getRandomNumber(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    static getRandomString(length) {
        let string = '';
        let possible = 'abcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < length; i++) {
            string += possible.charAt(Math.floor(Math.random() * possible.length));
        }

        return string;
    }

    static getHeightTopBar() {
        // if (this.isIOS()) {
        //     return (this.isIphoneX()) ? 50 : 20;
        // }
        return 0;
    }

    static getHeightActionBar() {
        return 50;
    }

    static now() {
        return moment().toDate();
    }

    static monthNow() {
        return Env.formatMonthName(Env.now());
    }

    static isToday(date){
        if(date !== null){
            if(date.toDateString() === Env.now().toDateString()){
                return true;
            }
        }
        return false;
    }

    static formatIso(date){
        return moment(date).toISOString();
    }

    // return Jul
    static formatDate(date, pattern){
        if(date !== null){
            return moment(date).format(pattern);
        }
        return '-';
    }

    static formatFullDate(date){
        return Env.formatDate(date, 'DD/MM/YYYY ddd');
    }

    static formatDateDay(date) {
        return Env.formatDate(date, 'DD/MM ddd');
    }

    // return Jul
    static formatMonthName(date) {
        return Env.formatDate(date, 'MMM');
    }

    // return 31/07
    static formatDateMonth(date) {
        return Env.formatDate(date, 'DD/MM');
    }

    // return period 0719
    // TODO: add logic to decide period per payday
    static formatMonthYear(date) {
        return Env.formatDate(date, 'MMYY');
    }

    static formatCurrency(amount) {

        if (amount === "") {
            return '0';
        }

        if(typeof amount === 'number'){
            return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        }
        else{
            return parseFloat(amount.replace(/\,/g, "")).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        }

    }

    static convertCurrency(amountStr) {
        if (amountStr != "") {
            let value = parseFloat(amountStr.replace(/\,|\+|\-/g, ""));
            return value;
        }
        return 0;
    }












    // REALM DATABASE -----------------

    static key = {
        USER_INFO: 'USER_INFO',         // refer to 'userInfo' object from react-native-google-signin
        ACCESS_TOKEN: 'ACCESS_TOKEN',
        BACKUP_FILE_ID: 'FILE_ID',
        BACKUP_STATUS: 'BACKUP_STATUS', // N/S/U --> None/Sync/Unsync
        BACKUP_TIME: 'BACKUP_TIME'
    }

    static schema = {
        name: 'Env',
        primaryKey: 'key',
        properties: {
            key: 'string',
            val: 'string',
            time: {
                type: 'date',
                default: Env.now()
            }
        }
    };

    // it will overwrite if the key already exist
    // give null as val to delete
    static writeStorage(key, val) {
        if (val !== null) {
            val = JSON.stringify(val);
        }

        let realm = new Realm({
            schema: [Env.schema, Env.categorySchema, Env.transactionSchema]
        });
        let records = realm.objects(Env.schema.name)
            .filtered('key = "' + key + '"');
        realm.write(() => {
            if (records.length > 0) {
                realm.delete(records);
            }
            if (val != null) {
                realm.create(Env.schema.name, {
                    key,
                    val
                });
            }
        });

    }

    // if the key doesn't exist, it will return null
    static readStorage(key) {
        let realm = new Realm({
            schema: [Env.schema, Env.categorySchema, Env.transactionSchema]
        });
        let records = realm.objects(Env.schema.name)
            .filtered('key = "' + key + '"');
        let result = (records.length > 0) ? records[0].val : null;

        return JSON.parse(result);
    }


    // CATEGORY MANAGER ----------------------------------------------

    //Transaction Type
    static EXPENSE_TYPE = 'Expense';
    static INCOME_TYPE = 'Income';

    static categorySchema = {
        name: 'Category',
        primaryKey: 'id',
        properties: {
            id: 'string',
            title: 'string',
            icon: 'int',        // contain require()
            color: 'string',
            type: 'string'
        }
    }

    static transactionSchema = {
        name: 'Transaction',
        primaryKey: 'id',
        properties: {
            id: 'string',
            categoryId: 'string',   // TODO: Consider to denormalize table for performance reason.
            amount: 'int',
            memo: 'string',
            period: 'string',       // relative with payday (MMYY/0719)
            date: {
                type: 'date',
                default: Env.now()
            },
            type: 'string'          // Expense/Income
        }
    }

    static changeBackupStatus() {
        let currentStatus = Env.readStorage(Env.key.BACKUP_STATUS);
        if(currentStatus === null || currentStatus === 'N'){
            return;
        }
        Env.writeStorage(Env.key.BACKUP_STATUS, 'U');
    }


    // for backup
    static getDatabase(){

        let realm = new Realm({
            schema: [Env.schema, Env.categorySchema, Env.transactionSchema]
        });

        let c = realm.objects('Category');
        let categories = [];
        c.forEach((item, index, array) => {
            categories.push({
                id: item.id,
                title: item.title,
                icon: item.icon,
                color: item.color,
                type: item.type
            });
        });

        let t = realm.objects('Transaction');
        let transactions = [];
        t.forEach((item, index, array) => {
            transactions.push({
                id: item.id,
                categoryId: item.categoryId,
                amount: item.amount,
                memo: item.memo,
                period: item.period,
                date: item.date,
                type: item.type
            });
        });

        return {
            last_updated: Env.now(),
            categories: categories,
            transactions: transactions
        }

    }

    static restoreDatabase(fileId, backupData){

        ToastAndroid.show('Restoring your data..', ToastAndroid.SHORT);

        const backupTime = backupData.last_updated;
        const categories = backupData.categories;
        const transactions = backupData.transactions;

        Env.writeStorage(Env.key.BACKUP_STATUS, 'S');
        Env.writeStorage(Env.key.BACKUP_TIME, backupTime);
        Env.writeStorage(Env.key.BACKUP_FILE_ID, fileId);

        let realm = new Realm({
            schema: [Env.schema, Env.categorySchema, Env.transactionSchema]
        });

        realm.write(() => {
            
            // delete current database
            let currentCategories = realm.objects('Category');
            realm.delete(currentCategories);
            let currentTransactions = realm.objects('Transaction');
            realm.delete(currentTransactions);
            
            categories.forEach((value, index, array) => {
                realm.create('Category', value);
            });
            transactions.forEach((value, index, array) => {
                realm.create('Transaction', value);
            });
        });

        ToastAndroid.show('Data restored', ToastAndroid.SHORT);

    }

    static reset() {

        // TODO: also delete file backup on Google Drive

        let realm = new Realm({
            schema: [Env.schema, Env.categorySchema, Env.transactionSchema]
        });

        realm.write(() => {
            let currentCategories = realm.objects('Category');
            realm.delete(currentCategories);
            let currentTransactions = realm.objects('Transaction');
            realm.delete(currentTransactions);

            let currentEnv = realm.objects('Env');
            realm.delete(currentEnv);
        });

    }


    static addCategory(category) {
        // consider add logic to check existing id.

        let realm = new Realm({
            schema: [Env.schema, Env.categorySchema, Env.transactionSchema]
        });
        realm.write(() => {
            realm.create('Category', category);
        });

    }

    static getCategories(id, type) {
        let realm = new Realm({
            schema: [Env.schema, Env.categorySchema, Env.transactionSchema]
        });

        let categories = realm.objects('Category');

        if (id !== null) {
            categories = categories.filtered('id = "' + id + '"');
            return (categories.length > 0) ? categories[0] : null;
        }

        if(type !== null){
            return categories.filtered('type = "' + type + '"');
        }

        return categories
    }

    // delete > means wipe out/erase/destroy from existance
    // remove > means move to somewhere else (e.g trash)
    static deleteCategory(id){

        // TODO: Add logic to delete transaction records also.

        let realm = new Realm({
            schema: [Env.schema, Env.categorySchema, Env.transactionSchema]
        });
        
        let categories = realm.objects('Category');
        let category = categories.filtered(`id = "${id}"`);
        if (category !== null) {
            realm.write(() => {
                realm.delete(category);
            });
        }
    }

    static saveTransaction(transaction){
        let realm = new Realm({
            schema: [Env.schema, Env.categorySchema, Env.transactionSchema]
        });

        realm.write(() => {
            realm.create('Transaction', transaction, true);
        });

        // set return isSuccess

    }

    static getTransaction(id){
        let realm = new Realm({
            schema: [Env.schema, Env.categorySchema, Env.transactionSchema]
        });

        let transactions = realm.objects('Transaction');
        transactions = transactions.filtered(`id = "${id}"`);

        return (transactions.length > 0) ? transactions[0] : null;
    }

    static getTransactionPerCategory(period, type){

        let realm = new Realm({
            schema: [Env.schema, Env.categorySchema, Env.transactionSchema]
        });

        let transactions = realm.objects('Transaction');
        transactions = transactions.filtered(`period = "${period}" AND type = "${type}"`);
        
        let data = [];
        let grandtotal = 0;     // use for count percentage

        // grouping transaction by category
        let tUnique = transactions.filtered(`TRUEPREDICATE DISTINCT(categoryId)`);
        for(let i=0; i<tUnique.length; i++){

            let categories = realm.objects('Category');
            let category = categories.filtered(`id = "${tUnique[i].categoryId}"`)[0];

            // sum amount per category
            let tPerCategory = transactions.filtered(`categoryId = "${category.id}"`);
            let total = 0;
            for(let j=0; j<tPerCategory.length; j++){
                total += tPerCategory[j].amount;
            }

            grandtotal += total;

            let item = {
                categoryId: category.id,
                title: category.title,
                icon: category.icon,
                color: category.color,
                total: total,
                percentage: 0, 
            }
            data.push(item);
        }

        // calculate percentage
        for (let i=0; i<data.length; i++) {
            let item = data[i];
            let percentage = (item.total/grandtotal) * 100;
            data[i].percentage = parseFloat(percentage.toFixed(1));
        }

        // sorting
        data.sort((a, b) => {
            if(a.total > b.total){
                return -1
            }
            return 1;
        });

        return data;
    }
    

    // TODO: Consider to move processing data on render to cut a lot of looping.
    static getTransactionByPeriod(period){
        let realm = new Realm({
            schema: [Env.schema, Env.categorySchema, Env.transactionSchema]
        });

        let transactions = realm.objects('Transaction');
        transactions = transactions.filtered(`period = "${period}"`);
        transactions = transactions.sorted('date', true);

        let data = [];
        let dataIndex = -1;

        let expenseTotal = 0;
        let incomeTotal = 0;

        let tempDate = null;
        transactions.forEach((value, index, array) => {

            let categories = realm.objects('Category');
            let category = categories.filtered(`id = "${value.categoryId}"`)[0]; 

            let transactionItem = {
                transactionId: value.id,
                icon: category.icon,
                color: category.color,
                memo: value.memo,
                amount: (value.type === Env.EXPENSE_TYPE) ?
                    ('- ' + Env.formatCurrency(value.amount)) : Env.formatCurrency(value.amount),
            }


            let currentDate = value.date.toDateString();
            if (tempDate !== currentDate) {     // new card
                tempDate = currentDate;

                expenseTotal = 0;
                incomeTotal = 0;
                if(value.type == Env.EXPENSE_TYPE){
                    expenseTotal = value.amount;
                }
                else{
                    incomeTotal = value.amount;
                }


                let transactionPerDay = {
                    transactionDate: Env.formatDateDay(value.date),
                    expenseTotal: expenseTotal,
                    incomeTotal: incomeTotal,
                    transactions: [transactionItem]
                }

                data.push(transactionPerDay);
                dataIndex += 1;

            }
            else{
                if(value.type == Env.EXPENSE_TYPE){
                    expenseTotal += value.amount;
                }
                else{
                    incomeTotal += value.amount;
                }


                let currentTransaction = data[dataIndex]; // transactionPerDay
                currentTransaction.expenseTotal = expenseTotal;
                currentTransaction.incomeTotal = incomeTotal;
                currentTransaction.transactions.push(transactionItem);

                data[dataIndex] = currentTransaction;
            }
            
        });



        return data;
    }

    static deleteTransaction(id){
        let realm = new Realm({
            schema: [Env.schema, Env.categorySchema, Env.transactionSchema]
        });

        let transactions = realm.objects('Transaction');
        let transaction = transactions.filtered(`id = "${id}"`);
        if(transaction !== null){
            realm.write(() => {
                realm.delete(transaction);
            });
        }
 
    }


    static initDefaultCategories(){

        // if category already exist, ignore this function
        // consider if user delete all categories
        let categories = Env.getCategories(null, null);
        if (categories.length > 0) {
            return;
        }

        let defaultCategories = [
            {
                id: Env.getRandomString(16),
                title: 'Bills',
                icon: require('../asset/categories/cat-shopping-bills.png'),
                color: '#778BEB',
                type: Env.EXPENSE_TYPE
            },
            {
                id: Env.getRandomString(16),
                title: 'Food',
                icon: require('../asset/categories/cat-food-chicken.png'),
                color: '#65C6C4',
                type: Env.EXPENSE_TYPE
            },
            {
                id: Env.getRandomString(16),
                title: 'Transportation',
                icon: require('../asset/categories/cat-transportation-bus.png'),
                color: '#F19066',
                type: Env.EXPENSE_TYPE
            },
            {
                id: Env.getRandomString(16),
                title: 'Hangout',
                icon: require('../asset/categories/cat-food-cocktail.png'),
                color: '#E3646D',
                type: Env.EXPENSE_TYPE
            },
            {
                id: Env.getRandomString(16),
                title: 'Phone',
                icon: require('../asset/categories/cat-gadget-mobile.png'),
                color: '#F19066',
                type: Env.EXPENSE_TYPE
            },
            {
                id: Env.getRandomString(16),
                title: 'Health',
                icon: require('../asset/categories/cat-medical-hospital.png'),
                color: '#2DB4E7',
                type: Env.EXPENSE_TYPE
            },

            {
                id: Env.getRandomString(16),
                title: 'Salary',
                icon: require('../asset/categories/cat-finance-wallet.png'),
                color: '#3498DB',
                type: Env.INCOME_TYPE
            },
            {
                id: Env.getRandomString(16),
                title: 'Investments',
                icon: require('../asset/categories/cat-finance-piggy.png'),
                color: '#FFF3A3',
                type: Env.INCOME_TYPE
            }
        ];

        defaultCategories.forEach((value, index, array) => {
            Env.addCategory(value);
        });
    }


    // category icon colors
    static COLORS = [
        '#FF7675', // 0
        '#778BEB',
        '#2DB4E7',
        '#F19066',
        '#65C6C4',
        '#E3646D',
        '#9F90F1',
        '#74B9FF',
        '#FFF3A3',
        '#7FE7CC',
        '#E0555E',
        '#9B59B6',
        '#3498DB',
        '#F5CD79',
        '#92CEBE', // 14
    ];


    static INCOME_ASSETS = [
        {
            category: 'Finance',
            icons: [
                {
                    icon: require('../asset/categories/cat-finance-atm.png'),
                    color: '#FF7675',
                }, 
                {
                    icon: require('../asset/categories/cat-finance-bag.png'),
                    color: '#778BEB'
                }, 
                {
                    icon: require('../asset/categories/cat-finance-bitcoin.png'),
                    color: '#2DB4E7'
                }, 
                {
                    icon: require('../asset/categories/cat-finance-card.png'),
                    color: '#F19066'
                }, 
                {
                    icon: require('../asset/categories/cat-finance-check.png'),
                    color: '#65C6C4'
                }, 
                {
                    icon: require('../asset/categories/cat-finance-diamond.png'),
                    color: '#E3646D'
                }, 
                {
                    icon: require('../asset/categories/cat-finance-mastercard.png'),
                    color: '#9F90F1'
                }, 
                {
                    icon: require('../asset/categories/cat-finance-money.png'),
                    color: '#74B9FF'
                }, 
                {
                    icon: require('../asset/categories/cat-finance-piggy.png'),
                    color: '#FFF3A3'
                }, 
                {
                    icon: require('../asset/categories/cat-finance-safe.png'),
                    color: '#7FE7CC'
                }, 
                {
                    icon: require('../asset/categories/cat-finance-stock.png'),
                    color: '#E0555E'
                }, 
                {
                    icon: require('../asset/categories/cat-finance-visa.png'),
                    color: '#9B59B6'
                }, 
                {
                    icon: require('../asset/categories/cat-finance-wallet.png'),
                    color: '#3498DB'
                },
            ]
        }
    ];

    static EXPENSE_ASSETS = [
        {
            category: 'Food',
            icons: [
                {
                    icon: require('../asset/categories/cat-food-apple.png'),
                    color: '#FF7675'
                },
                {
                    icon: require('../asset/categories/cat-food-broccoli.png'),
                    color: '#778BEB'
                },
                {
                    icon: require('../asset/categories/cat-food-burger.png'),
                    color: '#2DB4E7'
                },
                {
                    icon: require('../asset/categories/cat-food-cheese.png'),
                    color: '#F19066'
                },
                {
                    icon: require('../asset/categories/cat-food-chicken.png'),
                    color: '#65C6C4'
                },
                {
                    icon: require('../asset/categories/cat-food-cocktail.png'),
                    color: '#E3646D'
                },
                {
                    icon: require('../asset/categories/cat-food-coffee.png'),
                    color: '#9F90F1'
                },
                {
                    icon: require('../asset/categories/cat-food-fridge.png'),
                    color: '#74B9FF'
                },
                {
                    icon: require('../asset/categories/cat-food-icecream.png'),
                    color: '#FFF3A3'
                },
                {
                    icon: require('../asset/categories/cat-food-kettle.png'),
                    color: '#7FE7CC'
                },
                {
                    icon: require('../asset/categories/cat-food-pizza.png'),
                    color: '#E0555E'
                },
                {
                    icon: require('../asset/categories/cat-food-rice.png'),
                    color: '#9B59B6'
                },
                {
                    icon: require('../asset/categories/cat-food-tea.png'),
                    color: '#3498DB'
                },
                {
                    icon: require('../asset/categories/cat-food-toast.png'),
                    color: '#F5CD79'
                },
                {
                    icon: require('../asset/categories/cat-food-wine.png'),
                    color: '#92CEBE'
                },
            ]
        },
        {
            category: 'Transportation',
            icons: [
                {
                    icon: require('../asset/categories/cat-transportation-bicycle.png'),
                    color: '#FF7675'
                },
                {
                    icon: require('../asset/categories/cat-transportation-bike.png'),
                    color: '#778BEB'
                },
                {
                    icon: require('../asset/categories/cat-transportation-boarding.png'),
                    color: '#2DB4E7'
                },
                {
                    icon: require('../asset/categories/cat-transportation-bus.png'),
                    color: '#F19066'
                },
                {
                    icon: require('../asset/categories/cat-transportation-car.png'),
                    color: '#65C6C4'
                },
                {
                    icon: require('../asset/categories/cat-transportation-chopper.png'),
                    color: '#E3646D'
                },
                {
                    icon: require('../asset/categories/cat-transportation-gas.png'),
                    color: '#9F90F1'
                },
                {
                    icon: require('../asset/categories/cat-transportation-parking.png'),
                    color: '#74B9FF'
                },
                {
                    icon: require('../asset/categories/cat-transportation-plane.png'),
                    color: '#FFF3A3'
                },
                {
                    icon: require('../asset/categories/cat-transportation-ship.png'),
                    color: '#7FE7CC'
                },
                {
                    icon: require('../asset/categories/cat-transportation-taxi.png'),
                    color: '#E0555E'
                },
                {
                    icon: require('../asset/categories/cat-transportation-tow.png'),
                    color: '#9B59B6'
                },
                {
                    icon: require('../asset/categories/cat-transportation-train.png'),
                    color: '#3498DB'
                },
            ]
        },
        {
            category: 'Entertainment',
            icons: [
                {
                    icon: require('../asset/categories/cat-entertainment-badminton.png'),
                    color: '#FF7675'
                },
                {
                    icon: require('../asset/categories/cat-entertainment-basket.png'),
                    color: '#778BEB'
                },
                {
                    icon: require('../asset/categories/cat-entertainment-biking.png'),
                    color: '#2DB4E7'
                },
                {
                    icon: require('../asset/categories/cat-entertainment-bowling.png'),
                    color: '#F19066'
                },
                {
                    icon: require('../asset/categories/cat-entertainment-boxing.png'),
                    color: '#65C6C4'
                },
                {
                    icon: require('../asset/categories/cat-entertainment-card.png'),
                    color: '#E3646D'
                },
                {
                    icon: require('../asset/categories/cat-entertainment-disco.png'),
                    color: '#9F90F1'
                },
                {
                    icon: require('../asset/categories/cat-entertainment-dumbbell.png'),
                    color: '#74B9FF'
                },
                {
                    icon: require('../asset/categories/cat-entertainment-game.png'),
                    color: '#FFF3A3'
                },
                {
                    icon: require('../asset/categories/cat-entertainment-movies.png'),
                    color: '#7FE7CC'
                },
                {
                    icon: require('../asset/categories/cat-entertainment-music.png'),
                    color: '#E0555E'
                },
                {
                    icon: require('../asset/categories/cat-entertainment-skates.png'),
                    color: '#9B59B6'
                },
                {
                    icon: require('../asset/categories/cat-entertainment-ticket.png'),
                    color: '#3498DB'
                },
            ]
        },
        {
            category: 'Shopping',
            icons: [
                {
                    icon: require('../asset/categories/cat-shopping-bag.png'),
                    color: '#FF7675'
                },
                {
                    icon: require('../asset/categories/cat-shopping-bills.png'),
                    color: '#778BEB'
                },
                {
                    icon: require('../asset/categories/cat-shopping-bodysoap.png'),
                    color: '#2DB4E7'
                },
                {
                    icon: require('../asset/categories/cat-shopping-boots.png'),
                    color: '#F19066'
                },
                {
                    icon: require('../asset/categories/cat-shopping-cart.png'),
                    color: '#65C6C4'
                },
                {
                    icon: require('../asset/categories/cat-shopping-coupon.png'),
                    color: '#E3646D'
                },
                {
                    icon: require('../asset/categories/cat-shopping-dress.png'),
                    color: '#9F90F1'
                },
                {
                    icon: require('../asset/categories/cat-shopping-glasses.png'),
                    color: '#74B9FF'
                },
                {
                    icon: require('../asset/categories/cat-shopping-haircut.png'),
                    color: '#FFF3A3'
                },
                {
                    icon: require('../asset/categories/cat-shopping-heels.png'),
                    color: '#7FE7CC'
                },
                {
                    icon: require('../asset/categories/cat-shopping-lipstick.png'),
                    color: '#E0555E'
                },
                {
                    icon: require('../asset/categories/cat-shopping-masker.png'),
                    color: '#9B59B6'
                },
                {
                    icon: require('../asset/categories/cat-shopping-necklace.png'),
                    color: '#3498DB'
                },
                {
                    icon: require('../asset/categories/cat-shopping-perfume.png'),
                    color: '#F5CD79'
                },
                {
                    icon: require('../asset/categories/cat-shopping-shirt.png'),
                    color: '#92CEBE'
                },
                {
                    icon: require('../asset/categories/cat-shopping-tag.png'),
                    color: '#FF7675'
                },
            ]
        },
        {
            category: 'Furniture',
            icons: [
                {
                    icon: require('../asset/categories/cat-furniture-bathub.png'),
                    color: '#FF7675'
                },
                {
                    icon: require('../asset/categories/cat-furniture-bed.png'),
                    color: '#778BEB'
                },
                {
                    icon: require('../asset/categories/cat-furniture-fan.png'),
                    color: '#2DB4E7'
                },
                {
                    icon: require('../asset/categories/cat-furniture-flower.png'),
                    color: '#F19066'
                },
                {
                    icon: require('../asset/categories/cat-furniture-home.png'),
                    color: '#65C6C4'
                },
                {
                    icon: require('../asset/categories/cat-furniture-laundry.png'),
                    color: '#E3646D'
                },
                {
                    icon: require('../asset/categories/cat-furniture-light.png'),
                    color: '#9F90F1'
                },
                {
                    icon: require('../asset/categories/cat-furniture-sofa.png'),
                    color: '#74B9FF'
                },
                {
                    icon: require('../asset/categories/cat-furniture-toilet.png'),
                    color: '#FFF3A3'
                },
                {
                    icon: require('../asset/categories/cat-furniture-tools.png'),
                    color: '#7FE7CC'
                },
                {
                    icon: require('../asset/categories/cat-furniture-tv.png'),
                    color: '#E0555E'
                },
                {
                    icon: require('../asset/categories/cat-furniture-wardrobe.png'),
                    color: '#9B59B6'
                },
                {
                    icon: require('../asset/categories/cat-furniture-water.png'),
                    color: '#3498DB'
                },
            ]
        },
        {
            category: 'Family',
            icons: [
                {
                    icon: require('../asset/categories/cat-family-baby.png'),
                    color: '#FF7675'
                },
                {
                    icon: require('../asset/categories/cat-family-babybottle.png'),
                    color: '#778BEB'
                },
                {
                    icon: require('../asset/categories/cat-family-babycare.png'),
                    color: '#2DB4E7'
                },
                {
                    icon: require('../asset/categories/cat-family-beach.png'),
                    color: '#F19066'
                },
                {
                    icon: require('../asset/categories/cat-family-camping.png'),
                    color: '#65C6C4'
                },
                {
                    icon: require('../asset/categories/cat-family-dino.png'),
                    color: '#E3646D'
                },
                {
                    icon: require('../asset/categories/cat-family-family.png'),
                    color: '#9F90F1'
                },
                {
                    icon: require('../asset/categories/cat-family-gift.png'),
                    color: '#74B9FF'
                },
                {
                    icon: require('../asset/categories/cat-family-horse.png'),
                    color: '#FFF3A3'
                },
                {
                    icon: require('../asset/categories/cat-family-stroley.png'),
                    color: '#7FE7CC'
                },
            ]
        },
        {
            category: 'Gadget',
            icons: [
                {
                    icon: require('../asset/categories/cat-gadget-camera.png'),
                    color: '#FF7675'
                },
                {
                    icon: require('../asset/categories/cat-gadget-headphone.png'),
                    color: '#778BEB'
                },
                {
                    icon: require('../asset/categories/cat-gadget-laptop.png'),
                    color: '#2DB4E7'
                },
                {
                    icon: require('../asset/categories/cat-gadget-mobile.png'),
                    color: '#F19066'
                },
                {
                    icon: require('../asset/categories/cat-gadget-pc.png'),
                    color: '#65C6C4'
                },
                {
                    icon: require('../asset/categories/cat-gadget-phone.png'),
                    color: '#E3646D'
                },
                {
                    icon: require('../asset/categories/cat-gadget-printer.png'),
                    color: '#9F90F1'
                },
                {
                    icon: require('../asset/categories/cat-gadget-simcard.png'),
                    color: '#74B9FF'
                },
                {
                    icon: require('../asset/categories/cat-gadget-watch.png'),
                    color: '#FFF3A3'
                },
            ]
        },
        {
            category: 'Education',
            icons: [
                {
                    icon: require('../asset/categories/cat-education-archive.png'),
                    color: '#FF7675'
                },
                {
                    icon: require('../asset/categories/cat-education-book.png'),
                    color: '#778BEB'
                },
                {
                    icon: require('../asset/categories/cat-education-guitar.png'),
                    color: '#2DB4E7'
                },
                {
                    icon: require('../asset/categories/cat-education-painting.png'),
                    color: '#F19066'
                },
                {
                    icon: require('../asset/categories/cat-education-piano.png'),
                    color: '#65C6C4'
                },
            ]
        },
        {
            category: 'Medical',
            icons: [
                {
                    icon: require('../asset/categories/cat-medical-ambulance.png'),
                    color: '#FF7675'
                },
                {
                    icon: require('../asset/categories/cat-medical-bandage.png'),
                    color: '#778BEB'
                },
                {
                    icon: require('../asset/categories/cat-medical-hospital.png'),
                    color: '#2DB4E7'
                },
                {
                    icon: require('../asset/categories/cat-medical-inject.png'),
                    color: '#F19066'
                },
                {
                    icon: require('../asset/categories/cat-medical-insurance.png'),
                    color: '#65C6C4'
                },
                {
                    icon: require('../asset/categories/cat-medical-pills.png'),
                    color: '#E3646D'
                },
                {
                    icon: require('../asset/categories/cat-medical-transfusion.png'),
                    color: '#9F90F1'
                },
            ]
        },
    ];

    

}