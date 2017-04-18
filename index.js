//PACKAGES
var express     = require('express')
var bodyParser  = require('body-parser')
var fs          = require('fs')
var uuid        = require('node-uuid')

//VARIABLES
var path = process.argv[1].split('index.js')[0]
var json = {}
var load = function() {
  json = JSON.parse(fs.readFileSync(path + 'data.json'))
  calculate()
}
var save = function() {
  calculate()
  fs.writeFileSync(path + 'data.json',JSON.stringify(json))
}

//CLASSES
var Charge = function(date, amount, reason, rate) {
  this.id = uuid.v1()
  this.reason = reason
  this.date = date
  this.amount = amount
  this.rate = rate
  this.log = new Date(Date.now()).toString()
  json.charges.push(this)
  save()
}
var Payment = function(date, amount) {
  this.id = uuid.v1()
  this.date = date
  this.amount = amount
  this.log = new Date(Date.now()).toString()
  json.payments.push(this)
  save()
}
var Rate = function(date, rate) {
  this.id = uuid.v1()
  this.date = date
  this.rate = rate
  this.log = new Date(Date.now()).toString()
  json.rates.push(this)
  save()
}

//CALCULTIONS
var calculate = function(){
  var interest_charges = []
  var changes = [].concat(json.charges,json.payments)
  dateSort(changes)
  var pc = processChanges(changes, json.rates)
  var total = pc.total
  var interest_charges = pc.interest_charges
  var changes = pc.changes
  var now = new Date(Date.now())
  var completion_date = new Date(2018,8,25)
  var last_date = new Date( interest_charges[ interest_charges.length - 1 ].date )
  var current_total = total + calcTotalInterest( last_date, now, total )
  var y = now.getYear() + 1900
  var m = now.getMonth()
  var d = now.getDay()
  if ( d > 25 ) {
    if ( m == 11) {
      m = 0; y++
    } else {
      m++
    }
  }
  var next_date = new Date(y,m,25)
  total += calcTotalInterest( last_date, next_date, total )
  var next_amount = calcPayment(next_date, last_date, completion_date, total)
  var n = ((completion_date.getMonth()-next_date.getMonth())+((completion_date.getYear()-next_date.getYear())*12))+1
  var abs_total = ( next_amount * n )
  var total_interest = ( abs_total - total )
  json.changes = changes
  json.interest_charges = interest_charges
  json.info = {
    next_date: next_date.toString(),
    next_amount,
    abs_total,
    current_total,
    total_interest,
    completion_date: completion_date.toString()
  }
}
var processChanges = function(changes, rates) {
  var total = changes[0].amount
  var interest_charges = []
  var payment = 0
  for (var j = 1; j < changes.length; j++) {
    var c1 = changes[j-1]
    var c2 = changes[j]
    c1.date = new Date(c1.date)
    c2.date = new Date(c2.date)
    var rate = getRates( rates, c1.date, c2.date )
    if (rate.intermediates.length > 0) {
      rate.intermediates = dateSort( rate.intermediates )
      for (var i = 0; i < rate.intermediates.length; i++) {
        var r = rate.intermediates[i].rate
        if ( i == 0 ) {
          var d1 = new Date( c1.date )
          var d2 = new Date( rate.intermediates[i].date )
          payment = calcInterest( r, total, d1, d2 )
          interest_charges.push( { amount:payment.amount, date:d2.toString(), rate:rate.rate.rate, days:Math.round(payment.days), from:d1.toString() } )
          total += payment.amount
        }
        if ( i == rate.intermediates.length - 1 ) {
          var d1 = new Date( rate.intermediates[i].date )
          var d2 = new Date( c2.date )
        } else {
          var d1 = new Date( rate.intermediates[i].date )
          var d2 = new Date( rate.intermediates[i+1].date )
        }
        payment = calcInterest( r, total, d1, d2 )
        interest_charges.push( { amount:payment.amount, date:d2.toString(), rate:r, days:Math.round(payment.days), from:d1.toString() } )
        total += payment.amount
      }
    } else {
      payment = calcInterest( rate.rate.rate, total, c1.date, c2.date )
      total += payment.amount
      interest_charges.push( { amount:payment.amount, date:c2.date.toString(), rate:rate.rate.rate, days:Math.round(payment.days), from:c1.date.toString() } )
    }
    if (changes[j].reason == undefined) { total -= c2.amount } else { total += c2.amount }
  }
  return { total, changes, interest_charges }
}
var getRates = function(rates, d1, d2) {
  var rd = new Date(1971,1,1)
  var res = {
    rate:0,
    intermediates:[]
  }
  for (var i = 0; i < rates.length; i++) {
    var r = rates[i]
    r.date = new Date(r.date)
    if (r.date.getTime() <= d2.getTime()) {
      if (r.date.getTime() >= d1.getTime()) {
        res.intermediates.push(r)
      } else if (r.date.getTime() >= rd.getTime() && r.date.getTime() <= d1.getTime()) {
        rd = r.date
        res.rate = r
      }
    }
  }
  return res
}
var dateSort = function(array) {
  var sorted = true
  var swap = function(arr,i1,i2) {
    var tmp = arr[i2]
    arr[i2] = arr[i1]
    arr[i1] = tmp
  }
  var pass = function(arr) {
    sorted = true;
    for (var i = 1; i < arr.length; i++) {
      var d1 = new Date(arr[i-1].date)
      var d2 = new Date(arr[i].date)
      if (d1.getTime() > d2.getTime()) { swap(arr,i-1,i); sorted = false; }
    }
    if (!sorted) pass(arr);
  }
  pass(array)
  return array
}
var calcTotalInterest = function(d1, d2, total) {
  var rate = getRates( dateSort(json.rates), d1, d2 )
  var ti = 0
  if (rate.intermediates.length > 0) {
    rate.intermediates = dateSort(rate.intermediates)
    for (var i = 0; i < rate.intermediates.length; i++) {
      var r = rate.intermediates[i].rate
      if ( i == 0 ) {
        var _d1 = new Date( d1 )
        var _d2 = new Date( rate.intermediates[i].date )
        var t = calcInterest( r, total, _d1, _d2 ).amount
        ti += t; total += t;
      }
      if ( i == rate.intermediates.length - 1 ) {
        var _d1 = new Date( rate.intermediates[i].date )
        var _d2 = new Date( d2 )
      } else {
        var _d1 = new Date( rate.intermediates[i].date )
        var _d2 = new Date( rate.intermediates[i+1].date )
      }
      var t = calcInterest( r, total, _d1, _d2 ).amount
      ti += t; total += t;
    }
  } else {
    var t = calcInterest( rate.rate.rate, total, d1, d2 ).amount
    ti += t; total += t;
  }
  return ti
}
var calcInterest = function(r, t, d1, d2) {
  var d = Math.round((d2.getTime() - d1.getTime()) / ( 1000*3600*24 ))
  var l = 365; if (d2.getYear() % 4 == 0) l = 366;
  return { amount:Math.round( ( (d/l) * (r/100) * t ) * 100 ) / 100, days: d }
}
var calcPayment = function(next_date, last_date, completion_date, total) {
  var p = total + calcTotalInterest( last_date, next_date, total )
  var rate = getRates( dateSort(json.rates), next_date, completion_date )
  var yr = rate.rate.rate
  var max = completion_date.getTime() - next_date.getTime()
  if (rate.intermediates.length > 0) {
    var tr = 0
    for (var i = 0; i < rate.intermediates.length; i++) {
      if ( i == 0) {
        var d1 = next_date
        var d2 = rate.intermediates[i].date
        var dr = yr
      } else if ( i == rate.intermediates.length-1) {
        var d1 = rate.intermediates[i].date
        var d2 = completion_date
        var dr = rate.intermediates[i].rate
      } else {
        var d1 = rate.intermediates[i-1].date
        var d2 = rate.intermediates[i].date
        var dr = rate.intermediates[i-1].rate
      }
      var diff = d2.getTime() - d1.getTime()
      tr += (diff / max) * dr
    }
    yr = tr
  }
  var n = ((completion_date.getMonth()-next_date.getMonth())+((completion_date.getYear()-next_date.getYear())*12))+1
  var r = ( yr/100 )/12
  return p * ( (r * (Math.pow(1+r,n)) ) / ( (Math.pow(1+r,n)) - 1 ) )
}

//SERVER
var app = express()
app.use(express.static('site'))
app.use(bodyParser())
app.use(function(request,response,next) {
  var obj = {}
  try {
    var url = request.url
    var params_str = request.url.split('?')
    if (params_str.length > 1) {
      try {
        var params = params_str[1].split('&')
        for (var i = 0; i < params.length; i++) {
          var param = params[i].split('=')
          obj[param[0]] = param[1]
        }
        request.urlparams = obj
      } catch (e) {
        console.error(new Error(e).stack)
      }
    }
  } catch (e) {
    console.error(new Error(e).stack)
  }
  request.urlparams = obj
  load()
  next()
})
app.post('/delete*', function(request,response) {
  if (request.urlparams.id == undefined || request.urlparams.tbl == undefined) {
    response.status(200).send({ok:false}).end()
  } else {
    var id = request.urlparams.id
    var tbl = request.urlparams.tbl
    for (var i = json[tbl].length-1; i >= 0; i--) {
      if (json[tbl][i].id == id) {
        json[tbl].splice(i,1)
      }
    }
    save()
    response.status(200).send({ok:true}).end()
  }
})
app.post('/payment*', function(request,response) {
  var date = request.body.date
  var amount = request.body.amount
  new Payment(new Date(date).toString(), amount)
  response.status(200).send({ok:true}).end()
})
app.post('/rate*', function(request,response) {
  var date = new Date(request.body.date)
  var rate = request.body.rate
  new Rate(date.toString(), rate)
  response.status(200).send({ok:true}).end()
})
app.post('/charge*', function(request,response) {
  var date = new Date(request.body.date)
  var amount = request.body.amount
  var reason = request.body.reason
  var rate = 0.00
  var rd = new Date(1971,1,1).getTime()
  for (var i = 0; i < json.rates.length; i++) {
    var d = new Date(json.rates[i].date).getTime()
    if (d >= rd && d <= date.getTime()) {
      rate = json.rates[i].rate
      rd = new Date(json.rates[i].date)
    }
  }
  new Charge(date.toString(), amount, reason, rate)
  response.status(200).send({ok:true}).end()
})
app.get('/print*', function(request,response) {
  var res = dateSort([].concat(json.interest_charges, json.changes))
  response.status(200).send(res).end()
})
app.get('/load*', function(request,response) {
  response.status(200).send(json).end()
})

app.listen(8080)
