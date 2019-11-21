using System;
using System.Threading;
namespace task
{
    class Program
    {
        static void Main(string[] args)
        {
            for (int i = 0; i < 120; i++)
            {
                Thread.Sleep(10000); // go to sleep for 10s
                Console.WriteLine($"{(i + 1) * 10} seconds passed");
            }
        }
    }
}
