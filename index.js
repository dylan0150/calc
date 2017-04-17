var express     = require('express')
var bodyParser  = require('body-parser')
var fs          = require('fs')
var uuid        = require('node-uuid')

var path = process.argv[1].split('index.js')[0]

var json = {}
var load = function() {
  json = JSON.parse(fs.readFileSync(path + 'data.json'))
}
var save = function() {
  calculate()
  fs.writeFileSync(path + 'data.json',JSON.stringify(json))
}

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

var calculate = function(){
  load()
  var current_total   = 0
  var total_interest  = 0
  var interest_charges = []
  var payments = json.payments
  for (var i = 0; i < payments.length; i++) {
    payments[i].amount = -payments[i].amount
  }
  var changes = [].concat(json.charges,payments)
  dateSort(changes)
  var total = changes[0].amount
  for (var j = 1; j < changes.length; j++) {
    var c1 = changes[j-1]
    var c2 = changes[j]
    c1.date = new Date(c1.date)
    c2.date = new Date(c2.date)
    var rate = {}
    var rd = new Date(1971,1,1)
    for (var i = 0; i < json.rates.length; i++) {
      var r = json.rates[i]
      r.date = new Date(r.date)
      if (r.date.getTime() <= c2.date.getTime() && r.date.getTime() >= rd.getTime()) {
        rate = r
      }
    }
    if (c2.date.getTime() > rate.date.getTime()) {
      if (c2.date.getYear() % 4 == 0) { var len = 366 } else { var len = 365 }
      if (c1.date.getTime() <= rate.date.getTime()) {
        var diff = Math.round((c2.date.getTime() - rate.date.getTime()) / ( 1000*3600*24 ))
      } else {
        var diff = Math.round((c2.date.getTime() - c1.date.getTime()) / ( 1000*3600*24 ))
      }
      var payment = Math.round( ((diff/len) * (rate.rate/100) * total) * 100 ) / 100
      interest_charges.push( { amount:payment, date:c2.date.toString(), rate:rate.rate, days:Math.round(diff), from:c1.date.toString() } )
      total_interest += payment
      total += Math.round(payment)
      total += Math.round(c2.amount)
    }
  }
  var now = new Date(Date.now())
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
  var completion_date = new Date(2018,8,25)
  var last_date = new Date( interest_charges[ interest_charges.length - 1 ].date )
  if ( now.getYear() % 4 == 0 ) { var len = 365 } else { var len = 366 }
  var diff = Math.round(( now.getTime() - last_date.getTime()) / ( 1000*3600*24 ))
  var payment = Math.round( ((diff/len) * (4.5/100) * total) * 100 ) / 100
  var current_total = total + payment
  var next_amount = calcPayment(next_date, last_date, completion_date, total)
  var n = ((completion_date.getMonth()-next_date.getMonth())+((completion_date.getYear()-next_date.getYear())*12))+1
  var abs_total = ( next_amount * n )
  var total_interest = ( abs_total - total )
  load()
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

var calcPayment = function(next_date, last_date, completion_date, total) {
  if ( next_date.getYear() % 4 == 0 ) { var len = 365 } else { var len = 366 }
  var diff = Math.round(( next_date.getTime() - last_date.getTime()) / ( 1000*3600*24 ))
  var payment = Math.round( ((diff/len) * (4.5/100) * total) * 100 ) / 100
  var cr = json.rates[0]
  var ct = new Date(json.rates[0].date).getTime()
  for (var i = 0; i < json.rates.length; i++) {
    var rate = json.rates[i]
    var t = new Date(rate.date).getTime()
    if ( t <= next_date.getTime() && t >= ct ) {
      cr = rate;
      if ( t > last_date.getTime() ) {
        for (var j = 0; j < json.rates.length; j++) {
          var lt = new Date(json.rates[j].date).getTime()
          if (lt < ct && lt > last_date.getTime()) {
            var lr = json.rates[j]
            var rdiff = (lt-last_date.getTime()) / (next_date.getTime() - last_date.getTime())
          }
        }
        cr.rate = (cr.rate*(1-rdiff)) + (lr*rdiff)
      }
    }
  }
  var n = ((completion_date.getMonth()-next_date.getMonth())+((completion_date.getYear()-next_date.getYear())*12))+1
  var r = ( cr.rate/100 )/12
  var p = total + payment
  return p * ( (r * (Math.pow(1+r,n)) ) / ( (Math.pow(1+r,n)) - 1 ) )
}

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
        var params = params_str.split('&')
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
  request.params = obj
  load()
  next()
})

app.post('/delete*', function(request,response) {
  if (request.params.id == undefined || request.params.tbl == undefined) {
    response.status(200).send({ok:false}).end()
  } else {
    var id = request.params.id
    var tbl = request.params.tbl
    load()
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
  var data = { ok:true }
  response.status(200).send(data).end()
})
app.post('/rate*', function(request,response) {
  var date = new Date(request.body.date)
  var rate = request.body.rate
  new Rate(date.toString(), rate)
  var data = { ok:true }
  response.status(200).send(data).end()
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
    }
  }
  new Charge(date.toString(), amount, reason, rate)
  var data = { ok:true }
  response.status(200).send(data).end()
})
app.get('/print*', function(request,response) {
  load()
  calculate()
  var res = dateSort([].concat(json.interest_charges, json.changes))
  response.status(200).send(res).end()
})
app.get('/load*', function(request,response) {
  load()
  calculate()
  response.status(200).send(json).end()
})

app.listen(8080)
