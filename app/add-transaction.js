import React, { Component } from 'react';
import { 
    View, 
    Text,
    Image,
    TextInput,
    TouchableOpacity,
    ScrollView, 
    Keyboard,
    DatePickerAndroid,
    ToastAndroid,
} from 'react-native';
import Cicon from './comp/cicon';
import { Styles, Colors, Fonts } from './lib/styles';
import Env from './lib/env';


export default class AddTransaction extends Component {

    constructor(props) {
        super(props);

        this.state = {
            transactionType: Env.EXPENSE_TYPE,
            eCategories: [],
            iCategories: [],
            iKey: null,     // iconKey

            showCombobox: false,

            categoryId: null,
            icon: null,
            color: null,
            memo: null,
            amount: '0',    // amountStr
            date1: 'Today',
            date2: Env.formatDateMonth(new Date()),

            inputShow: false,
            keyboardShow: false,
            doCalculate: false,
        };

        // board
        this.defaultMemo = '';
        this.transactionDate = Env.now();
        this.firstValue = null;     // in Number
        this.operation = null       // + / -

        this.editMode = false;

    }

    componentDidMount() {

        this.keyboardDidShowListener = Keyboard.addListener(
            'keyboardDidShow', this.onKeyboardDidShow.bind(this));
        this.keyboardDidHideListener = Keyboard.addListener(
            'keyboardDidHide', this.onKeyboardDidHide.bind(this));

        let eCategories = Env.getCategories(null, Env.EXPENSE_TYPE);
        let iCategories = Env.getCategories(null, Env.INCOME_TYPE);

        

        this.transaction = this.props.navigation.getParam('transaction');

        // EDIT MODE
        if (this.transaction !== undefined) {

            this.editMode = true;

            let category = Env.getCategories(this.transaction.categoryId, null);
            this.transactionDate = this.transaction.date;

            let iKey = null;
            if(this.transaction.type === Env.EXPENSE_TYPE){
                iKey = this.getIkey(category.id, eCategories);
            }
            else{
                iKey = this.getIkey(category.id, iCategories);
            }
            
            this.setState({
                transactionType: this.transaction.type,
                eCategories: eCategories,
                iCategories: iCategories,
                iKey: iKey,

                categoryId: category.id,
                icon: category.icon,
                color: category.color,
                memo: this.transaction.memo,
                amount: Env.formatCurrency(this.transaction.amount),
                date1: (Env.isToday(this.transactionDate)) ? 
                    'Today' : Env.formatDateMonth(this.transactionDate),
                date2: (Env.isToday(this.transactionDate)) ? 
                    Env.formatDateMonth(this.transactionDate) : this.transactionDate.getFullYear().toString(),

                inputShow: true,
            });

            
        }
        else{
            this.editMode = false;
            this.transaction = null;
            this.setState({eCategories, iCategories});
        }
    }

    componentWillUnmount() {
        this.keyboardDidShowListener.remove();
        this.keyboardDidHideListener.remove();
    }

    onKeyboardDidShow(e){
        // const { height, screenX, screenY, width } = e.endCoordinates;
        this.setState({keyboardShow: true});
    }

    onKeyboardDidHide(e){
        this.setState({keyboardShow: false});
    }

    getIkey(categoryId, categories){
        for(let i=0;i<categories.length;i++){
            if(categoryId === categories[i].id){
                return i;
            }
        }
    }

    async showDatePicker() {
        try {
            // WARNING: month --> 0=Jan
            const {action, year, month, day} = await DatePickerAndroid.open({
                date: this.transactionDate
            });

            if(action !== DatePickerAndroid.dismissedAction){
                this.transactionDate = new Date(year, month, day);  
                if (Env.isToday(this.transactionDate)) {
                    this.setState({
                        date1: 'Today',
                        date2: Env.formatDateMonth(this.transactionDate)
                    });
                } else {
                    this.setState({
                        date1: Env.formatDateMonth(this.transactionDate),
                        date2: year.toString()
                    });
                }
            }
            
        } catch ({code, message}) {
            console.warn('Cannot open DatePicker', message);
        }
    }

    onType(digit) {

        if(digit === 'C'){
            this.setState({amount: '0', doCalculate: false});
            this.operation = null;
            this.firstValue = null;
            return;
        }

        if(digit === 'D'){
            if (this.state.amount.length <= 1) {
                this.setState({amount: '0'});
            }
            else{
                if(this.operation === null){
                    let amountStr = this.state.amount.slice(0, -1);
                    this.setState({amount: Env.formatCurrency(amountStr)});
                }
                else{
                    let amountStr = this.state.amount;
                    let secondValue = amountStr.slice(amountStr.indexOf(this.operation) + 1);
                    secondValue = secondValue.slice(0, -1);

                    if(secondValue === ''){
                        amountStr = amountStr.slice(0, -1);
                        this.setState({
                            amount: amountStr,
                            doCalculate: false
                        });
                        let lastDigit = amountStr.slice(-1);
                        if (lastDigit === '+' || lastDigit === '-'){
                            // do nothing
                        }
                        else{
                            this.operation = null;
                            this.firstValue = null;
                        }  
                    }
                    else{
                        
                        secondValue = Env.formatCurrency(secondValue);
                        this.setState({
                            amount: amountStr.slice(0, amountStr.indexOf(this.operation) + 1) + secondValue
                        });
                    }
                }
            }
            return;
        }

        if(digit === '+' || digit === '-'){
            if(this.operation === null){
                this.operation = digit;
                this.firstValue = Env.convertCurrency(this.state.amount);

                let amountStr = this.state.amount + digit;
                this.setState({amount: amountStr});
            }
            else{
                let amountStr = this.state.amount;
                let secondValue = amountStr.slice(amountStr.indexOf(this.operation) + 1);

                if(secondValue === '') {
                    if (this.operation !== digit){
                        // change current operation
                        this.operation = digit;
                        amountStr = amountStr.slice(0, -1) + digit;
                        this.setState({amount: amountStr});
                    }
                    return;
                }

                // do calculate
                secondValue = Env.convertCurrency(secondValue);
                let newValue = (this.operation === '+') ? 
                    (this.firstValue + secondValue) : (this.firstValue - secondValue);
                    
                this.setState({
                    amount: Env.formatCurrency(newValue.toString()) + digit,
                    doCalculate: false,
                });
                this.operation = digit;
                this.firstValue = newValue;
            }

            return;
        }

        // do calculate
        if(digit === '='){
            let amountStr = this.state.amount;
            let secondValue = amountStr.slice(amountStr.indexOf(this.operation) + 1);

            secondValue = Env.convertCurrency(secondValue);
            let newValue = (this.operation === '+') ? 
                (this.firstValue + secondValue) : (this.firstValue - secondValue);
                    
            this.setState({
                amount: Env.formatCurrency(newValue.toString()),
                doCalculate: false,
            });
            this.operation = null;
            this.firstValue = 0;

            return;
        }

        if(this.operation === null){
            let amountStr = this.state.amount + digit;
            this.setState({amount: Env.formatCurrency(amountStr)});
        }
        else{
            let amountStr = this.state.amount + digit;
            let secondValue = amountStr.slice(amountStr.indexOf(this.operation) + 1);
            secondValue = Env.formatCurrency(secondValue);
            this.setState({
                amount: amountStr.slice(0, amountStr.indexOf(this.operation)+1) + secondValue,
                doCalculate: true,
            });
        }
        
    }


    saveTransaction(){
        if(this.state.doCalculate){
            this.onType('=');
            return;
        }

        // save transaction
        let memo = this.state.memo;
        if(memo === null || memo === ''){
            memo = this.defaultMemo;
        }

        let t = {
            id: Env.getRandomString(16),
            categoryId: this.state.categoryId,
            amount: Env.convertCurrency(this.state.amount),
            memo: memo,
            period: Env.formatMonthYear(this.transactionDate),
            date: this.transactionDate,
            type: this.state.transactionType
        }
        
        // edit mode
        if(this.editMode){
            t.id = this.transaction.id;
        }
        
        Env.saveTransaction(t);

        Env.changeBackupStatus();

        ToastAndroid.show('Transaction saved', ToastAndroid.SHORT);
        this.props.navigation.state.params.onNavigateBack(t);
        this.props.navigation.goBack();

    }

    renderActionBar() {
        return(
            <View style={[Styles.actionbarBox, {justifyContent: 'flex-start'}]}>
                <TouchableOpacity style={Styles.backButton} 
                    onPress={() => { this.props.navigation.goBack(); }}>
                    <Image style={Styles.icon18} source={require('./asset/back.png')}/>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {this.setState({showCombobox: !this.state.showCombobox}) }}>
                    <View style={Styles.periodButtonBox}>
                        <Text style={Styles.periodButtonLabel}>{this.state.transactionType}</Text>
                        <Image style={Styles.icon8} source={require('./asset/down.png')}/>
                    </View>
                </TouchableOpacity>
            </View>
        );
    }

    renderCombobox() {
        if(this.state.showCombobox){
            return(
                <View style={Styles.comboTypeBox}>
                    <TouchableOpacity 
                        onPress={() => {
                            this.setState({transactionType: Env.EXPENSE_TYPE, showCombobox: false, iKey: null});
                        }}>
                        <View style={Styles.comboTypeItem}>
                            <Text style={{flex: 1, color: Colors.darkGrey}}>Expenses</Text>
                            {this.renderChecked(Env.EXPENSE_TYPE)}
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => {
                            this.setState({transactionType: Env.INCOME_TYPE, showCombobox: false, iKey: null});
                        }}>
                        <View style={Styles.comboTypeItem}>
                            <Text style={{flex: 1, color: Colors.darkGrey}}>Income</Text>
                            {this.renderChecked(Env.INCOME_TYPE)}
                        </View>
                    </TouchableOpacity>
                </View>
            );
        }
        return null;
    }

    renderChecked(own){
        if(this.state.transactionType === own){
            return(
                <Image style={Styles.icon18} source={require('./asset/checked.png')}/>
            );
        }
        return null;
    }

    renderCategories() {
        let categories = (this.state.transactionType === Env.EXPENSE_TYPE) ? 
            this.state.eCategories : this.state.iCategories;
            
        return(
            <View style={{flex: 1}}>
                {this.renderCombobox()}
                <ScrollView>
                    <View style={Styles.addIconListBox}>
                        {
                            categories.map((item, key) => {
                                return(
                                    <TouchableOpacity key={key} 
                                        onPress={() => { 
                                            this.setState({
                                                iKey: key,
                                                icon: item.icon,
                                                color: item.color,
                                                categoryId: item.id,
                                                inputShow: true
                                            }); 
                                            this.defaultMemo = item.title;
                                        }}>
                                        <View style={ Styles.addIconBox}>
                                            <Cicon id={key} sid={this.state.iKey}
                                                icon={item.icon} 
                                                color={(this.state.iKey === key) ? item.color : Colors.lightGrey} />
                                            <Text style={{fontSize: Fonts.h6}}>{item.title}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })
                        }
                    </View>
                </ScrollView>
                {this.renderInput()}
            </View>
        );
    }

    

    renderInput() {
        if(this.state.inputShow){
            return(
                <View style={[Styles.boardBox, {height: (this.state.keyboardShow) ? 50 : 280}]}>
                    <View style={Styles.boardInputBox}>
                        <Cicon style={{width: 30, height: 30}}
                            icon={this.state.icon} color={this.state.color}/>
                        <TextInput 
                            style={Styles.boardInput} 
                            autoCorrect={false}
                            underlineColorAndroid={'transparent'}
                            placeholder={'Memo'}
                            onChangeText={(text) => this.setState({memo: text})}
                            value={this.state.memo} />
                        <Text style={{fontWeight: 'bold'}}>{this.state.amount}</Text>
                    </View>
                    {this.renderBoard()}
                </View>
            );
        }
        return null;
    }

    renderBoard() {
        if(!this.state.keyboardShow){
            return(
                <View style={{flex: 1}}>
                    <View style={Styles.boardKeyBox}>
                        <TouchableOpacity style={Styles.boardKey}
                            onPress={() => this.onType('7')}>
                            <Text style={Styles.boardDigit}>7</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={Styles.boardKey}
                            onPress={() => this.onType('8')}>
                            <Text style={Styles.boardDigit}>8</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={Styles.boardKey}
                            onPress={() => this.onType('9')}>
                            <Text style={Styles.boardDigit}>9</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={Styles.boardKey}
                            onPress={() => this.showDatePicker()}>
                            <View style={Styles.center}>
                                <Text>{this.state.date1}</Text>
                                <Text style={{fontSize: Fonts.h6, color: Colors.grey}}>
                                    {this.state.date2}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                    <View style={Styles.boardKeyBox}>
                        <TouchableOpacity style={Styles.boardKey}
                            onPress={() => this.onType('4')}>
                            <Text style={Styles.boardDigit}>4</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={Styles.boardKey}
                            onPress={() => this.onType('5')}>
                            <Text style={Styles.boardDigit}>5</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={Styles.boardKey}
                            onPress={() => this.onType('6')}>
                            <Text style={Styles.boardDigit}>6</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={Styles.boardKey}
                            onPress={() => this.onType('+')}>
                            <Image style={Styles.icon10} 
                                source={require('./asset/add.png')}/>
                        </TouchableOpacity>
                    </View>
                    <View style={Styles.boardKeyBox}>
                        <TouchableOpacity style={Styles.boardKey}
                            onPress={() => this.onType('1')}>
                            <Text style={Styles.boardDigit}>1</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={Styles.boardKey}
                            onPress={() => this.onType('2')}>
                            <Text style={Styles.boardDigit}>2</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={Styles.boardKey}
                            onPress={() => this.onType('3')}>
                            <Text style={Styles.boardDigit}>3</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={Styles.boardKey}
                            onPress={() => this.onType('-')}>
                            <Image style={Styles.icon10} 
                                source={require('./asset/minus.png')}/>
                        </TouchableOpacity>
                    </View>
                    <View style={Styles.boardKeyBox}>
                        <TouchableOpacity style={Styles.boardKey}
                            onPress={() => this.onType('C')}>
                            <Text style={Styles.boardDigit}>C</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={Styles.boardKey}
                            onPress={() => this.onType('0')}>
                            <Text style={Styles.boardDigit}>0</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={Styles.boardKey}
                            onPress={() => this.onType('D')}>
                            <Image style={Styles.icon18} 
                                source={require('./asset/backspace.png')}/>
                        </TouchableOpacity>
                        <TouchableOpacity style={[Styles.boardKey, {backgroundColor: Colors.primary}]}
                            onPress={() => this.saveTransaction()}>
                            {
                                (this.state.doCalculate) ? 
                                <Text style={Styles.boardDigit}>=</Text> :
                                <Image style={Styles.icon18} source={require('./asset/checked.png')}/>
                            }
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }
    }

    render() {
        return (
            <View style={Styles.sceneBox}>
                {this.renderActionBar()}
                {this.renderCategories()}
            </View>
        );
    }
}
